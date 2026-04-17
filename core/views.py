from rest_framework import viewsets, status, filters, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from .permissions import IsAdminUser, IsAuthorOrReadOnly
from rest_framework.views import APIView
from django.db.models import Q, Count, F, ExpressionWrapper, FloatField, DurationField, Value, Case, When, Prefetch
from django.db.models.functions import Cast
from django.db import DatabaseError, transaction, IntegrityError
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import logging

from .models import (
    UserProfile, State, District, City, Category, Tag, Issue,
    Media, Comment, Vote, IssueView, IssueAdminNote,
    AssignmentCategory, WorkflowTransition
)
from .serializers import (
    UserSerializer, UserProfileSerializer, RegisterSerializer,
    StateSerializer, DistrictSerializer, CitySerializer,
    CategorySerializer, TagSerializer,
    IssueListSerializer, IssueDetailSerializer, IssueCreateSerializer,
    MediaSerializer, CommentSerializer, VoteSerializer,
    IssueAdminNoteSerializer, AdminIssueListSerializer, AdminIssueDetailSerializer,
    AssignmentCategorySerializer, WorkflowTransitionSerializer
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom serializer to support login with username OR email"""
    
    def validate(self, attrs):
        # Check if username is actually an email
        username_or_email = attrs.get('username', '')
        password = attrs.get('password', '')
        
        # Try to find user by email if '@' is present
        if '@' in username_or_email:
            try:
                user = User.objects.get(email=username_or_email)
                attrs['username'] = user.username  # Replace email with username for JWT validation
            except User.DoesNotExist:
                pass  # Let the default validation handle the error
        
        return super().validate(attrs)
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Ensure we're working with the right data format
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
            
            # Log incoming data for debugging (without sensitive info)
            logger.info(f"Registration attempt - fields: {list(data.keys())}")
            
            serializer = RegisterSerializer(data=data)
            if serializer.is_valid():
                try:
                    user = serializer.save()
                    refresh = RefreshToken.for_user(user)
                    return Response({
                        'user': UserSerializer(user).data,
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                    }, status=status.HTTP_201_CREATED)
                except Exception as e:
                    logger.error(f"Error creating user: {e}", exc_info=True)
                    return Response({
                        'error': 'Failed to create user account',
                        'detail': str(e)
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Format errors for better frontend handling
            logger.warning(f"Validation failed: {serializer.errors}")
            errors = {}
            for field, field_errors in serializer.errors.items():
                if isinstance(field_errors, list):
                    errors[field] = field_errors[0] if field_errors else 'Invalid value'
                elif isinstance(field_errors, dict):
                    # Handle nested errors
                    errors[field] = str(field_errors)
                else:
                    errors[field] = str(field_errors)
            
            return Response({
                'error': 'Validation failed',
                'errors': errors,
                'detail': 'Please check the form fields and try again'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error in registration: {e}", exc_info=True)
            return Response({
                'error': 'An unexpected error occurred',
                'detail': str(e)
            },             status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CurrentUserView(APIView):
    """Current authenticated user - includes is_staff for admin UI"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    @action(detail=True, methods=['get'])
    def profile(self, request, pk=None):
        user = self.get_object()
        profile, created = UserProfile.objects.get_or_create(user=user)
        serializer = UserProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)


class StateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = State.objects.all()
    serializer_class = StateSerializer
    permission_classes = [AllowAny]


class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]
    filterset_fields = ['state']

    def get_queryset(self):
        queryset = super().get_queryset()
        state_id = self.request.query_params.get('state', None)
        if state_id:
            queryset = queryset.filter(state_id=state_id)
        return queryset


class CityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    permission_classes = [AllowAny]
    filterset_fields = ['district']

    def get_queryset(self):
        queryset = super().get_queryset()
        district_id = self.request.query_params.get('district', None)
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        return queryset


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]


class TagViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [AllowAny]
    search_fields = ['name']
    ordering_fields = ['usage_count', 'name']
    ordering = ['-usage_count']


class IssueViewSet(viewsets.ModelViewSet):
    queryset = Issue.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    search_fields = ['title', 'description', 'tags__name']
    ordering_fields = ['created_at', 'upvotes_count', 'comments_count', 'trending_score']
    ordering = ['-created_at']
    filterset_fields = ['category', 'state', 'district', 'city', 'scope', 'status']
    allowed_media_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav', 'm4a', 'ogg'}
    image_extensions = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
    video_extensions = {'mp4', 'mov', 'avi', 'webm'}
    audio_extensions = {'mp3', 'wav', 'm4a', 'ogg'}

    def get_serializer_class(self):
        if self.action == 'list':
            return IssueListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return IssueCreateSerializer
        elif self.action == 'retrieve':
            return IssueDetailSerializer
        return IssueDetailSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsAuthorOrReadOnly()]
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by location
        state_id = self.request.query_params.get('state', None)
        district_id = self.request.query_params.get('district', None)
        city_id = self.request.query_params.get('city', None)
        scope = self.request.query_params.get('scope', None)
        
        if state_id:
            queryset = queryset.filter(state_id=state_id)
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        if scope:
            queryset = queryset.filter(scope=scope)
        
        # Filter by category
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Filter by status
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Sort options
        sort_by = getattr(self, '_forced_sort_by', None) or self.request.query_params.get('sort_by', None)
        if sort_by == 'trending':
            now = timezone.now()
            engagement_expr = ExpressionWrapper(
                F('upvotes_count') - F('downvotes_count') + (F('comments_count') * Value(2.0)),
                output_field=FloatField(),
            )
            queryset = queryset.annotate(
                engagement_score=engagement_expr,
                recency_weight=Case(
                    When(created_at__gte=now - timedelta(days=1), then=Value(1.0)),
                    When(created_at__gte=now - timedelta(days=7), then=Value(0.75)),
                    When(created_at__gte=now - timedelta(days=30), then=Value(0.5)),
                    default=Value(0.3),
                    output_field=FloatField(),
                ),
            ).annotate(
                trending_score_calc=ExpressionWrapper(
                    F('engagement_score') * F('recency_weight'),
                    output_field=FloatField(),
                )
            ).order_by('-trending_score_calc', '-created_at')
        elif sort_by == 'votes':
            queryset = queryset.annotate(
                score=F('upvotes_count') - F('downvotes_count')
            ).order_by('-score', '-created_at')
        elif sort_by == 'comments':
            queryset = queryset.order_by('-comments_count', '-created_at')
        elif sort_by == 'recent':
            queryset = queryset.order_by('-created_at')
        
        return queryset.select_related('author', 'category', 'state', 'district', 'city', 'assigned_to').prefetch_related(
            'tags',
            'media_files',
            'workflow_transitions',
            Prefetch(
                'comments',
                queryset=Comment.objects.filter(parent=None, is_deleted=False).select_related('author').order_by('-upvotes_count', '-created_at'),
                to_attr='feed_comments',
            ),
        )

    def list(self, request, *args, **kwargs):
        """
        Defensive fallback: if trending annotation fails on any DB/backend edge case,
        gracefully fall back to recent instead of returning 500.
        """
        try:
            return super().list(request, *args, **kwargs)
        except DatabaseError as exc:
            sort_by = request.query_params.get('sort_by')
            if sort_by == 'trending':
                logger = logging.getLogger(__name__)
                logger.exception("Trending query failed; falling back to recent ordering.", exc_info=exc)
                self._forced_sort_by = 'recent'
                try:
                    return super().list(request, *args, **kwargs)
                finally:
                    self._forced_sort_by = None
            raise

    def perform_create(self, serializer):
        logger = logging.getLogger(__name__)

        validated_media = self._validate_media_files()
        submission_token = serializer.validated_data.pop('submission_token', None)

        with transaction.atomic():
            issue = serializer.save(author=self.request.user, submission_token=submission_token)
            logger.info(f"Issue created successfully: {issue.id}")

            for index, file_data in enumerate(validated_media):
                Media.objects.create(
                    issue=issue,
                    file=file_data['file'],
                    media_type=file_data['media_type'],
                    order=index
                )

            # Auto-assign to initiator based on issue category
            if issue.category and issue.category.assignment_category:
                ac = issue.category.assignment_category
                if ac.initiator_admin:
                    issue.assigned_to = ac.initiator_admin
                    issue.workflow_stage = 'pending'
                    issue.save()
                    WorkflowTransition.objects.create(
                        issue=issue,
                        from_stage='',
                        to_stage='pending',
                        assigned_to=ac.initiator_admin,
                        performed_by=ac.initiator_admin,
                        notes='Auto-assigned on creation'
                    )
                    logger.info(f"Issue {issue.id} auto-assigned to {ac.initiator_admin.username}")
    
    def create(self, request, *args, **kwargs):
        """Override create to return detailed serializer response"""
        submission_token = request.data.get('submission_token')
        if submission_token and request.user.is_authenticated:
            existing_issue = Issue.objects.filter(
                author=request.user,
                submission_token=submission_token
            ).select_related('author', 'category', 'state', 'district', 'city').first()
            if existing_issue:
                detail_serializer = IssueDetailSerializer(existing_issue, context={'request': request})
                payload = detail_serializer.data
                payload['duplicate_submission'] = True
                return Response(payload, status=status.HTTP_200_OK)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            self.perform_create(serializer)
        except IntegrityError:
            if submission_token and request.user.is_authenticated:
                existing_issue = Issue.objects.filter(
                    author=request.user,
                    submission_token=submission_token
                ).select_related('author', 'category', 'state', 'district', 'city').first()
                if existing_issue:
                    detail_serializer = IssueDetailSerializer(existing_issue, context={'request': request})
                    payload = detail_serializer.data
                    payload['duplicate_submission'] = True
                    return Response(payload, status=status.HTTP_200_OK)
            raise

        # Return the created issue using the detail serializer
        issue = serializer.instance
        detail_serializer = IssueDetailSerializer(issue, context={'request': request})
        headers = self.get_success_headers(detail_serializer.data)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def mine(self, request):
        queryset = self.get_queryset().filter(author=request.user)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = IssueListSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = IssueListSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def _validate_media_files(self):
        validated_media = []
        for key, uploaded_file in self.request.FILES.items():
            if not (key.startswith('media_') or key == 'file'):
                continue
            file_ext = uploaded_file.name.rsplit('.', 1)[-1].lower() if '.' in uploaded_file.name else ''
            if file_ext not in self.allowed_media_extensions:
                raise serializers.ValidationError({
                    'media': f'Unsupported file format: {uploaded_file.name}.'
                })
            if file_ext in self.image_extensions:
                media_type = 'image'
            elif file_ext in self.video_extensions:
                media_type = 'video'
            elif file_ext in self.audio_extensions:
                media_type = 'audio'
            else:
                raise serializers.ValidationError({
                    'media': f'Unable to determine media type for: {uploaded_file.name}.'
                })
            validated_media.append({'file': uploaded_file, 'media_type': media_type})
        return validated_media

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        issue = self.get_object()
        vote_type = request.data.get('vote_type', 'upvote')
        
        if vote_type not in ['upvote', 'downvote']:
            return Response(
                {'error': 'Invalid vote type. Must be "upvote" or "downvote".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already voted
        existing_vote = Vote.objects.filter(user=request.user, issue=issue).first()
        
        if existing_vote:
            if existing_vote.vote_type == vote_type:
                # Remove vote if clicking same button
                if vote_type == 'upvote':
                    issue.upvotes_count = max(0, issue.upvotes_count - 1)
                else:
                    issue.downvotes_count = max(0, issue.downvotes_count - 1)
                existing_vote.delete()
                issue.save()
                return Response({'message': 'Vote removed', 'vote_type': None})
            else:
                # Change vote type
                if existing_vote.vote_type == 'upvote':
                    issue.upvotes_count = max(0, issue.upvotes_count - 1)
                    issue.downvotes_count += 1
                else:
                    issue.downvotes_count = max(0, issue.downvotes_count - 1)
                    issue.upvotes_count += 1
                existing_vote.vote_type = vote_type
                existing_vote.save()
                issue.save()
                return Response({'message': 'Vote updated', 'vote_type': vote_type})
        else:
            # Create new vote
            Vote.objects.create(user=request.user, issue=issue, vote_type=vote_type)
            if vote_type == 'upvote':
                issue.upvotes_count += 1
            else:
                issue.downvotes_count += 1
            issue.save()
            return Response({'message': 'Vote added', 'vote_type': vote_type})

    @action(detail=True, methods=['post'])
    def view(self, request, pk=None):
        issue = self.get_object()
        ip_address = self.get_client_ip(request)
        
        # Track view
        IssueView.objects.get_or_create(
            issue=issue,
            user=request.user if request.user.is_authenticated else None,
            ip_address=ip_address if not request.user.is_authenticated else None,
            defaults={'viewed_at': timezone.now()}
        )
        
        # Update view count
        issue.views_count = IssueView.objects.filter(issue=issue).count()
        issue.save()
        
        return Response({'views_count': issue.views_count})

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        try:
            issue = self.get_object()
            comments = issue.comments.filter(parent=None, is_deleted=False).order_by('-created_at')
            serializer = CommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error loading comments: {e}")
            return Response(
                {'error': 'Failed to load comments', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        issue_id = self.request.data.get('issue')
        issue = Issue.objects.get(id=issue_id)
        serializer.save(issue=issue)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.filter(is_deleted=False)
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    ordering_fields = ['created_at', 'upvotes_count']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = super().get_queryset()
        issue_id = self.request.query_params.get('issue', None)
        if issue_id:
            queryset = queryset.filter(issue_id=issue_id)
        return queryset.select_related('author', 'issue', 'parent')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        comment = self.get_object()
        vote_type = request.data.get('vote_type', 'upvote')
        
        if vote_type not in ['upvote', 'downvote']:
            return Response(
                {'error': 'Invalid vote type. Must be "upvote" or "downvote".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user already voted
        existing_vote = Vote.objects.filter(user=request.user, comment=comment).first()
        
        if existing_vote:
            if existing_vote.vote_type == vote_type:
                # Remove vote
                if vote_type == 'upvote':
                    comment.upvotes_count = max(0, comment.upvotes_count - 1)
                else:
                    comment.downvotes_count = max(0, comment.downvotes_count - 1)
                existing_vote.delete()
                comment.save()
                return Response({'message': 'Vote removed', 'vote_type': None})
            else:
                # Change vote type
                if existing_vote.vote_type == 'upvote':
                    comment.upvotes_count = max(0, comment.upvotes_count - 1)
                    comment.downvotes_count += 1
                else:
                    comment.downvotes_count = max(0, comment.downvotes_count - 1)
                    comment.upvotes_count += 1
                existing_vote.vote_type = vote_type
                existing_vote.save()
                comment.save()
                return Response({'message': 'Vote updated', 'vote_type': vote_type})
        else:
            # Create new vote
            Vote.objects.create(user=request.user, comment=comment, vote_type=vote_type)
            if vote_type == 'upvote':
                comment.upvotes_count += 1
            else:
                comment.downvotes_count += 1
            comment.save()
            return Response({'message': 'Vote added', 'vote_type': vote_type})


class SearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response({'results': []})
        
        # Search issues
        issues = Issue.objects.filter(
            Q(title__icontains=query) |
            Q(description__icontains=query) |
            Q(tags__name__icontains=query)
        ).distinct()[:20]
        
        issue_serializer = IssueListSerializer(issues, many=True, context={'request': request})
        
        # Search tags
        tags = Tag.objects.filter(name__icontains=query)[:10]
        tag_serializer = TagSerializer(tags, many=True)
        
        return Response({
            'issues': issue_serializer.data,
            'tags': tag_serializer.data,
        })


# ---------- Admin views (staff only) ----------

class AdminDashboardStatsView(APIView):
    """Dashboard stats for admin"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from django.db.models import Count
        total = Issue.objects.count()
        by_status = dict(
            Issue.objects.values('status').annotate(count=Count('id')).values_list('status', 'count')
        )
        # Ensure all statuses present
        for s in ['pending', 'under_review', 'in_progress', 'resolved', 'rejected']:
            by_status.setdefault(s, 0)
        recent_7d = Issue.objects.filter(
            created_at__gte=timezone.now() - timedelta(days=7)
        ).count()
        pending_count = Issue.objects.filter(status='pending').count()
        return Response({
            'total_issues': total,
            'by_status': by_status,
            'recent_7_days': recent_7d,
            'pending_count': pending_count,
        })


class AdminGrievanceUpdateSerializer(serializers.ModelSerializer):
    """Only status, is_featured, is_verified for admin update"""
    class Meta:
        model = Issue
        fields = ['status', 'is_featured', 'is_verified']


class AdminGrievanceViewSet(viewsets.ModelViewSet):
    """Admin: list, retrieve, and update grievances (issues)"""
    queryset = Issue.objects.all()
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ['status', 'category', 'state', 'district', 'city']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'upvotes_count', 'comments_count']
    ordering = ['-created_at']
    http_method_names = ['get', 'head', 'post', 'patch', 'options']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return AdminIssueDetailSerializer
        if self.action in ('partial_update', 'update'):
            return AdminGrievanceUpdateSerializer
        if self.action == 'list':
            return AdminIssueListSerializer
        return IssueListSerializer

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'author', 'category', 'state', 'district', 'city', 'assigned_to'
        ).prefetch_related('tags', 'media_files', 'admin_notes', 'workflow_transitions')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        category_filter = self.request.query_params.get('category')
        if category_filter:
            queryset = queryset.filter(category_id=category_filter)

        state_filter = self.request.query_params.get('state')
        if state_filter:
            queryset = queryset.filter(state_id=state_filter)

        district_filter = self.request.query_params.get('district')
        if district_filter:
            queryset = queryset.filter(district_id=district_filter)

        city_filter = self.request.query_params.get('city')
        if city_filter:
            queryset = queryset.filter(city_id=city_filter)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        ordering = self.request.query_params.get('ordering')
        allowed_ordering = {'created_at', '-created_at', 'upvotes_count', '-upvotes_count', 'comments_count', '-comments_count'}
        if ordering in allowed_ordering:
            queryset = queryset.order_by(ordering)

        return queryset

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data
        if 'status' in data:
            instance.status = data['status']
        if 'is_featured' in data:
            instance.is_featured = bool(data['is_featured'])
        if 'is_verified' in data:
            instance.is_verified = bool(data['is_verified'])
        if instance.status == 'resolved' and not instance.resolved_at:
            instance.resolved_at = timezone.now()
        if instance.status != 'resolved':
            instance.resolved_at = None
        instance.save()
        serializer = AdminIssueDetailSerializer(instance, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def notes(self, request, pk=None):
        """List or create admin notes for this grievance"""
        issue = self.get_object()
        if request.method == 'GET':
            notes = issue.admin_notes.all().select_related('author').order_by('-created_at')
            return Response(IssueAdminNoteSerializer(notes, many=True).data)
        # POST
        serializer = IssueAdminNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(issue=issue, author=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def workflow(self, request, pk=None):
        """Advance workflow: to_stage, assigned_to (optional), notes"""
        from .models import WORKFLOW_STAGES
        issue = self.get_object()
        data = request.data
        to_stage = data.get('to_stage')
        if not to_stage:
            return Response({'error': 'to_stage is required'}, status=status.HTTP_400_BAD_REQUEST)
        valid_stages = [s[0] for s in WORKFLOW_STAGES]
        if to_stage not in valid_stages:
            return Response({'error': f'Invalid stage. Must be one of: {valid_stages}'}, status=status.HTTP_400_BAD_REQUEST)

        assigned_to = None
        if data.get('assigned_to'):
            try:
                assigned_to = User.objects.get(pk=data['assigned_to'], is_staff=True)
            except User.DoesNotExist:
                return Response({'error': 'Invalid assigned_to user'}, status=status.HTTP_400_BAD_REQUEST)
        elif to_stage == 'pending':
            # Keep current assignee or initiator
            assigned_to = issue.assigned_to

        from_stage = issue.workflow_stage
        issue.workflow_stage = to_stage
        issue.assigned_to = assigned_to
        issue.save()

        WorkflowTransition.objects.create(
            issue=issue,
            from_stage=from_stage,
            to_stage=to_stage,
            assigned_to=assigned_to,
            performed_by=request.user,
            notes=data.get('notes', '')
        )
        serializer = AdminIssueDetailSerializer(issue, context={'request': request})
        return Response(serializer.data)


class AdminStaffListView(APIView):
    """List staff users for assignment dropdown"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        staff = User.objects.filter(is_staff=True).order_by('username')
        return Response([{
            'id': u.id,
            'username': u.username,
            'name': u.get_full_name() or u.username,
            'email': u.email,
        } for u in staff])


class AssignmentCategoryViewSet(viewsets.ModelViewSet):
    """Admin: CRUD assignment categories"""
    queryset = AssignmentCategory.objects.all()
    serializer_class = AssignmentCategorySerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return super().get_queryset().select_related('initiator_admin').prefetch_related('issue_categories')
