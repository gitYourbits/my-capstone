from rest_framework import serializers
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from .models import (
    UserProfile, State, District, City, Category, Tag, Issue,
    Media, Comment, Vote, IssueView, IssueAdminNote,
    AssignmentCategory, WorkflowTransition
)


class UserSerializer(serializers.ModelSerializer):
    """User Serializer"""
    is_staff = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined', 'is_staff']
        read_only_fields = ['id', 'date_joined', 'is_staff']


class UserProfileSerializer(serializers.ModelSerializer):
    """User Profile Serializer"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'phone_number', 'avatar', 'bio', 'is_verified', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    """Registration Serializer"""
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        min_length=8,
        style={'input_type': 'password'}
    )
    password2 = serializers.CharField(
        write_only=True, 
        required=True,
        style={'input_type': 'password'}
    )
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True, max_length=150)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'first_name', 'last_name']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
        }

    def validate_username(self, value):
        """Validate username"""
        if not value or len(value.strip()) == 0:
            raise serializers.ValidationError("Username cannot be empty.")
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value.strip()

    def validate_email(self, value):
        """Validate email"""
        if not value or len(value.strip()) == 0:
            raise serializers.ValidationError("Email cannot be empty.")
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.strip().lower()

    def validate(self, attrs):
        """Cross-field validation"""
        if attrs.get('password') != attrs.get('password2'):
            raise serializers.ValidationError({
                "password2": "Password fields didn't match."
            })
        return attrs

    def create(self, validated_data):
        """Create user and profile"""
        password2 = validated_data.pop('password2')
        password = validated_data.pop('password')
        
        user = User.objects.create_user(
            username=validated_data.get('username'),
            email=validated_data.get('email'),
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        
        # Create user profile
        UserProfile.objects.get_or_create(user=user)
        
        return user


class StateSerializer(serializers.ModelSerializer):
    """State Serializer"""
    class Meta:
        model = State
        fields = ['id', 'name', 'code']


class DistrictSerializer(serializers.ModelSerializer):
    """District Serializer"""
    state_name = serializers.CharField(source='state.name', read_only=True)
    
    class Meta:
        model = District
        fields = ['id', 'name', 'code', 'state', 'state_name']


class CitySerializer(serializers.ModelSerializer):
    """City Serializer"""
    district_name = serializers.CharField(source='district.name', read_only=True)
    state_name = serializers.CharField(source='district.state.name', read_only=True)
    
    class Meta:
        model = City
        fields = ['id', 'name', 'district', 'district_name', 'state_name', 'latitude', 'longitude']


class CategorySerializer(serializers.ModelSerializer):
    """Category Serializer"""
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'icon', 'color']


class TagSerializer(serializers.ModelSerializer):
    """Tag Serializer"""
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug', 'usage_count']


class MediaSerializer(serializers.ModelSerializer):
    """Media Serializer"""
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Media
        fields = ['id', 'file', 'file_url', 'media_type', 'thumbnail', 'thumbnail_url', 'caption', 'order']
        read_only_fields = ['id']
    
    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
    
    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None


class CommentSerializer(serializers.ModelSerializer):
    """Comment Serializer"""
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'issue', 'author', 'author_name', 'author_avatar', 'content',
            'is_anonymous', 'parent', 'replies', 'upvotes_count', 'downvotes_count',
            'is_edited', 'created_at', 'updated_at', 'user_vote'
        ]
        read_only_fields = ['id', 'author', 'upvotes_count', 'downvotes_count', 'created_at', 'updated_at']
    
    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return obj.author.get_full_name() or obj.author.username
    
    def get_author_avatar(self, obj):
        if obj.is_anonymous:
            return None
        if hasattr(obj.author, 'profile') and obj.author.profile.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.author.profile.avatar.url)
            return obj.author.profile.avatar.url
        return None
    
    def get_replies(self, obj):
        if obj.replies.exists():
            return CommentSerializer(obj.replies.all(), many=True, context=self.context).data
        return []
    
    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            if vote:
                return vote.vote_type
        return None


class IssueListSerializer(serializers.ModelSerializer):
    """Issue List Serializer (for feed)"""
    author_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    location = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)
    first_image = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    
    assigned_to_name = serializers.SerializerMethodField()
    workflow_stage_label = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    top_comments = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            'id', 'title', 'description', 'author_name', 'is_anonymous',
            'category', 'category_name', 'location', 'tags', 'first_image',
            'upvotes_count', 'downvotes_count', 'comments_count', 'score',
            'status', 'scope', 'created_at', 'user_vote',
            'assigned_to_name', 'workflow_stage', 'workflow_stage_label', 'is_owner', 'top_comments'
        ]

    def get_assigned_to_name(self, obj):
        return (obj.assigned_to.get_full_name() or obj.assigned_to.username) if obj.assigned_to else None

    def get_workflow_stage_label(self, obj):
        labels = {'pending': 'Pending', 'acknowledged': 'Acknowledged', 'assigned_to_team': 'Assigned to Team',
                  'resolution_done': 'Resolution Done', 'validated': 'Validated', 'remarks': 'Closed'}
        return labels.get(obj.workflow_stage, obj.workflow_stage or 'Pending')
    
    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return obj.author.get_full_name() or obj.author.username
    
    def get_location(self, obj):
        return {
            'city': obj.city.name if obj.city else None,
            'district': obj.district.name if obj.district else None,
            'state': obj.state.name if obj.state else None,
        }
    
    def get_first_image(self, obj):
        first_media = obj.media_files.filter(media_type='image').first()
        if first_media:
            request = self.context.get('request')
            # Use original image in cards to prevent low-res thumbnail upscaling artifacts.
            image_url = first_media.file.url
            if request:
                return request.build_absolute_uri(image_url)
            return image_url
        return None
    
    def get_score(self, obj):
        return obj.get_score()
    
    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            if vote:
                return vote.vote_type
        return None

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)

    def get_top_comments(self, obj):
        feed_comments = getattr(obj, 'feed_comments', [])
        top_two = feed_comments[:2]
        return [
            {
                'id': c.id,
                'author_name': 'Anonymous' if c.is_anonymous else (c.author.get_full_name() or c.author.username),
                'content': c.content,
                'upvotes_count': c.upvotes_count,
            }
            for c in top_two
        ]


class IssueDetailSerializer(serializers.ModelSerializer):
    """Issue Detail Serializer"""
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    media_files = MediaSerializer(many=True, read_only=True)
    location = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    trending_score = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    
    assigned_to_name = serializers.SerializerMethodField()
    workflow_stage_label = serializers.SerializerMethodField()
    workflow_transitions_public = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            'id', 'title', 'description', 'author', 'author_name', 'author_avatar',
            'is_anonymous', 'category', 'tags', 'media_files', 'location',
            'upvotes_count', 'downvotes_count', 'comments_count', 'views_count',
            'score', 'trending_score', 'status', 'scope', 'is_featured',
            'is_verified', 'created_at', 'updated_at', 'resolved_at', 'user_vote',
            'assigned_to_name', 'workflow_stage', 'workflow_stage_label', 'workflow_transitions_public', 'is_owner'
        ]

    def get_assigned_to_name(self, obj):
        return (obj.assigned_to.get_full_name() or obj.assigned_to.username) if obj.assigned_to else None

    def get_workflow_stage_label(self, obj):
        labels = {'pending': 'Pending', 'acknowledged': 'Acknowledged', 'assigned_to_team': 'Assigned to Team',
                  'resolution_done': 'Resolution Done', 'validated': 'Validated', 'remarks': 'Closed'}
        return labels.get(obj.workflow_stage, obj.workflow_stage or 'Pending')

    def get_workflow_transitions_public(self, obj):
        transitions = obj.workflow_transitions.all().order_by('-created_at')[:5]
        return [
            {
                'to_stage': t.to_stage,
                'assigned_to_name': t.assigned_to.get_full_name() or t.assigned_to.username if t.assigned_to else None,
                'performed_by_name': t.performed_by.get_full_name() or t.performed_by.username,
                'created_at': t.created_at.isoformat(),
                'notes': t.notes or '',
            }
            for t in transitions
        ]
        read_only_fields = [
            'id', 'author', 'upvotes_count', 'downvotes_count', 'comments_count',
            'views_count', 'created_at', 'updated_at'
        ]
    
    def get_author_name(self, obj):
        if obj.is_anonymous:
            return "Anonymous"
        return obj.author.get_full_name() or obj.author.username
    
    def get_author_avatar(self, obj):
        if obj.is_anonymous:
            return None
        if hasattr(obj.author, 'profile') and obj.author.profile.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.author.profile.avatar.url)
            return obj.author.profile.avatar.url
        return None
    
    def get_location(self, obj):
        return {
            'city': {
                'id': obj.city.id if obj.city else None,
                'name': obj.city.name if obj.city else None,
            },
            'district': {
                'id': obj.district.id if obj.district else None,
                'name': obj.district.name if obj.district else None,
            },
            'state': {
                'id': obj.state.id if obj.state else None,
                'name': obj.state.name if obj.state else None,
            },
        }
    
    def get_score(self, obj):
        return obj.get_score()
    
    def get_trending_score(self, obj):
        return obj.get_trending_score()
    
    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            if vote:
                return vote.vote_type
        return None

    def get_is_owner(self, obj):
        request = self.context.get('request')
        return bool(request and request.user.is_authenticated and obj.author_id == request.user.id)


class IssueCreateSerializer(serializers.ModelSerializer):
    """Issue Create/Update Serializer"""
    tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        write_only=True  # Important: don't try to serialize this field in response
    )
    submission_token = serializers.CharField(required=False, allow_blank=False, max_length=64, write_only=True)
    
    class Meta:
        model = Issue
        fields = [
            'id', 'title', 'description', 'is_anonymous', 'category', 'state', 'district', 'city',
            'scope', 'tags', 'submission_token', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def to_internal_value(self, data):
        # Handle FormData - convert string values to appropriate types
        if hasattr(data, 'getlist'):
            # It's a QueryDict (from FormData)
            internal_data = {}
            for key in self.fields:
                if key == 'tags':
                    # Get all tag values
                    tags = data.getlist('tags', [])
                    internal_data[key] = [t for t in tags if t]
                elif key in ['is_anonymous']:
                    value = data.get(key, 'false')
                    internal_data[key] = value.lower() in ['true', '1', 'yes']
                elif key in ['category', 'state', 'district', 'city']:
                    value = data.get(key)
                    internal_data[key] = int(value) if value else None
                else:
                    internal_data[key] = data.get(key)
            return super().to_internal_value(internal_data)
        return super().to_internal_value(data)
    
    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        # Don't set author here - it's passed from perform_create in the view
        issue = Issue.objects.create(**validated_data)
        
        # Handle tags
        for tag_name in tags_data:
            clean_name = self._normalize_tag_name(tag_name)
            if clean_name:  # Skip empty tags
                tag, created = Tag.objects.get_or_create(
                    name=clean_name,
                    defaults={'slug': self._generate_unique_slug(clean_name)}
                )
                issue.tags.add(tag)
                if created:
                    tag.usage_count = 1
                else:
                    tag.usage_count += 1
                tag.save()
        
        return issue
    
    def update(self, instance, validated_data):
        validated_data.pop('submission_token', None)
        tags_data = validated_data.pop('tags', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update tags if provided
        if tags_data is not None:
            instance.tags.clear()
            for tag_name in tags_data:
                clean_name = self._normalize_tag_name(tag_name)
                if not clean_name:
                    continue
                tag, created = Tag.objects.get_or_create(
                    name=clean_name,
                    defaults={'slug': self._generate_unique_slug(clean_name)}
                )
                instance.tags.add(tag)
                if created:
                    tag.usage_count = 1
                else:
                    tag.usage_count += 1
                tag.save()
        
        return instance

    def validate_tags(self, value):
        normalized = []
        seen = set()
        for raw_tag in value or []:
            clean_name = self._normalize_tag_name(raw_tag)
            if not clean_name:
                continue
            if len(clean_name) > 100:
                raise serializers.ValidationError("Each tag can be up to 100 characters.")
            if clean_name in seen:
                continue
            seen.add(clean_name)
            normalized.append(clean_name)
        if len(normalized) > 15:
            raise serializers.ValidationError("You can add up to 15 tags per issue.")
        return normalized

    def _normalize_tag_name(self, raw_tag):
        if not raw_tag:
            return ""
        return " ".join(str(raw_tag).strip().lower().split())

    def _generate_unique_slug(self, tag_name):
        base_slug = slugify(tag_name)[:120] or tag_name.replace(" ", "-")[:120]
        slug_candidate = base_slug
        counter = 2
        while Tag.objects.filter(slug=slug_candidate).exists():
            suffix = f"-{counter}"
            slug_candidate = f"{base_slug[:120 - len(suffix)]}{suffix}"
            counter += 1
        return slug_candidate


class IssueAdminNoteSerializer(serializers.ModelSerializer):
    """Admin note on an issue"""
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = IssueAdminNote
        fields = ['id', 'issue', 'author', 'author_name', 'note_type', 'content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'issue', 'author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        return obj.author.get_full_name() or obj.author.username


class WorkflowTransitionSerializer(serializers.ModelSerializer):
    """Workflow transition log"""
    performed_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowTransition
        fields = ['id', 'issue', 'from_stage', 'to_stage', 'assigned_to', 'assigned_to_name', 'performed_by', 'performed_by_name', 'notes', 'created_at']

    def get_performed_by_name(self, obj):
        return obj.performed_by.get_full_name() or obj.performed_by.username

    def get_assigned_to_name(self, obj):
        return (obj.assigned_to.get_full_name() or obj.assigned_to.username) if obj.assigned_to else None


class AssignmentCategorySerializer(serializers.ModelSerializer):
    """Assignment category for admin config"""
    initiator_admin_name = serializers.SerializerMethodField()
    issue_categories = serializers.SerializerMethodField()

    class Meta:
        model = AssignmentCategory
        fields = ['id', 'name', 'slug', 'description', 'initiator_admin', 'initiator_admin_name', 'display_order', 'issue_categories']

    def get_initiator_admin_name(self, obj):
        return (obj.initiator_admin.get_full_name() or obj.initiator_admin.username) if obj.initiator_admin else None

    def get_issue_categories(self, obj):
        return [{'id': c.id, 'name': c.name, 'slug': c.slug} for c in obj.issue_categories.all()]


class AdminIssueListSerializer(IssueListSerializer):
    """Issue list for admin - includes assigned_to, workflow_stage"""
    assigned_to_name = serializers.SerializerMethodField()

    class Meta(IssueListSerializer.Meta):
        fields = IssueListSerializer.Meta.fields + ['assigned_to', 'assigned_to_name', 'workflow_stage']

    def get_assigned_to_name(self, obj):
        return (obj.assigned_to.get_full_name() or obj.assigned_to.username) if obj.assigned_to else None


class AdminIssueDetailSerializer(IssueDetailSerializer):
    """Issue detail for admin - includes admin_notes, workflow"""
    admin_notes = IssueAdminNoteSerializer(many=True, read_only=True)
    workflow_transitions = WorkflowTransitionSerializer(many=True, read_only=True)
    assigned_to_name = serializers.SerializerMethodField()

    class Meta(IssueDetailSerializer.Meta):
        fields = IssueDetailSerializer.Meta.fields + [
            'admin_notes', 'workflow_transitions', 'assigned_to', 'assigned_to_name', 'workflow_stage'
        ]

    def get_assigned_to_name(self, obj):
        return (obj.assigned_to.get_full_name() or obj.assigned_to.username) if obj.assigned_to else None


class VoteSerializer(serializers.ModelSerializer):
    """Vote Serializer"""
    class Meta:
        model = Vote
        fields = ['id', 'vote_type', 'issue', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate(self, attrs):
        if not attrs.get('issue') and not attrs.get('comment'):
            raise serializers.ValidationError("Either issue or comment must be provided.")
        if attrs.get('issue') and attrs.get('comment'):
            raise serializers.ValidationError("Cannot vote on both issue and comment.")
        return attrs

