from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import FileExtensionValidator
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Q
from PIL import Image
import os
from io import BytesIO
from django.core.files.base import ContentFile


class UserProfile(models.Model):
    """Extended user profile with additional information"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    bio = models.TextField(max_length=500, blank=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"


class State(models.Model):
    """Indian States"""
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, unique=True, blank=True, null=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class District(models.Model):
    """Districts within States"""
    name = models.CharField(max_length=100)
    state = models.ForeignKey(State, on_delete=models.CASCADE, related_name='districts')
    code = models.CharField(max_length=10, blank=True, null=True)

    class Meta:
        unique_together = ['name', 'state']
        ordering = ['name']

    def __str__(self):
        return f"{self.name}, {self.state.name}"


class City(models.Model):
    """Cities within Districts"""
    name = models.CharField(max_length=100)
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='cities')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    class Meta:
        unique_together = ['name', 'district']
        ordering = ['name']

    def __str__(self):
        return f"{self.name}, {self.district.name}"


class AssignmentCategory(models.Model):
    """Admin assignment buckets - maps to initiator who gets new issues (4-5 categories)"""
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    initiator_admin = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='initiator_for_assignment_categories',
        limit_choices_to={'is_staff': True}
    )
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name_plural = "Assignment Categories"
        ordering = ['display_order', 'name']

    def __str__(self):
        return self.name


class Category(models.Model):
    """Issue Categories"""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)  # Icon name for frontend
    color = models.CharField(max_length=7, default='#3B82F6')  # Hex color code
    assignment_category = models.ForeignKey(
        AssignmentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='issue_categories'
    )

    class Meta:
        verbose_name_plural = "Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class Tag(models.Model):
    """Hashtags/Tags for issues"""
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    usage_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-usage_count', 'name']

    def __str__(self):
        return f"#{self.name}"


class Issue(models.Model):
    """Main Issue/Post Model"""
    SCOPE_CHOICES = [
        ('city', 'City Level'),
        ('district', 'District Level'),
        ('state', 'State Level'),
        ('national', 'National Level'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('under_review', 'Under Review'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='issues')
    is_anonymous = models.BooleanField(default=False)
    
    # Location
    city = models.ForeignKey(City, on_delete=models.SET_NULL, null=True, related_name='issues')
    district = models.ForeignKey(District, on_delete=models.SET_NULL, null=True, related_name='issues')
    state = models.ForeignKey(State, on_delete=models.SET_NULL, null=True, related_name='issues')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='city')
    
    # Categorization
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='issues')
    tags = models.ManyToManyField(Tag, related_name='issues', blank=True)

    # Workflow & Assignment
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_issues',
        limit_choices_to={'is_staff': True}
    )
    workflow_stage = models.CharField(max_length=30, default='pending')  # pending, acknowledged, assigned_to_team, resolution_done, validated, remarks
    
    # Engagement metrics
    upvotes_count = models.IntegerField(default=0)
    downvotes_count = models.IntegerField(default=0)
    comments_count = models.IntegerField(default=0)
    views_count = models.IntegerField(default=0)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    is_featured = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    submission_token = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['state', 'district', 'city']),
            models.Index(fields=['category']),
            models.Index(fields=['status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['author', 'submission_token'],
                condition=Q(submission_token__isnull=False),
                name='unique_issue_submission_per_author'
            )
        ]

    def __str__(self):
        return self.title

    def get_score(self):
        """Calculate net score (upvotes - downvotes)"""
        return self.upvotes_count - self.downvotes_count

    def get_trending_score(self):
        """Calculate trending score based on recency and engagement"""
        hours_since_creation = (timezone.now() - self.created_at).total_seconds() / 3600
        if hours_since_creation < 1:
            hours_since_creation = 1
        return (self.get_score() + self.comments_count * 2) / (hours_since_creation ** 0.5)


class Media(models.Model):
    """Media files (photos, videos, audio) for issues"""
    MEDIA_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
        ('audio', 'Audio'),
    ]

    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='media_files')
    file = models.FileField(
        upload_to='issue_media/',
        validators=[
            FileExtensionValidator(
                allowed_extensions=['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'm4a']
            )
        ]
    )
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    thumbnail = models.ImageField(upload_to='thumbnails/', blank=True, null=True)
    caption = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.media_type} for {self.issue.title}"
    
    def generate_thumbnail(self):
        """Generate thumbnail for image media"""
        if self.media_type != 'image' or not self.file:
            return
        
        try:
            # Open the image
            img = Image.open(self.file)
            
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = rgb_img
            
            # Calculate thumbnail size (max 300x300, maintain aspect ratio)
            max_size = (300, 300)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save thumbnail to BytesIO
            thumb_io = BytesIO()
            # Determine format
            format = 'JPEG' if img.format != 'PNG' else 'PNG'
            img.save(thumb_io, format=format, quality=85, optimize=True)
            thumb_io.seek(0)
            
            # Generate thumbnail filename
            file_name = os.path.basename(self.file.name)
            name, ext = os.path.splitext(file_name)
            thumb_filename = f"{name}_thumb{ext if format == 'PNG' else '.jpg'}"
            
            # Save thumbnail
            self.thumbnail.save(
                thumb_filename,
                ContentFile(thumb_io.read()),
                save=False
            )
            thumb_io.close()
        except Exception as e:
            # If thumbnail generation fails, continue without thumbnail
            print(f"Error generating thumbnail: {e}")
            pass


@receiver(post_save, sender=Media)
def generate_media_thumbnail(sender, instance, created, **kwargs):
    """Signal to generate thumbnail when media is created"""
    if created and instance.media_type == 'image' and not instance.thumbnail:
        instance.generate_thumbnail()
        # Save again to store the thumbnail
        instance.save(update_fields=['thumbnail'])


class Comment(models.Model):
    """Comments on issues"""
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    is_anonymous = models.BooleanField(default=False)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    
    # Engagement
    upvotes_count = models.IntegerField(default=0)
    downvotes_count = models.IntegerField(default=0)
    
    # Moderation
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['issue', '-created_at']),
        ]

    def __str__(self):
        return f"Comment by {self.author.username} on {self.issue.title}"


class IssueAdminNote(models.Model):
    """Admin notes/responses on issues - internal and optionally public"""
    NOTE_TYPE_CHOICES = [
        ('internal', 'Internal Note'),
        ('public_response', 'Public Response'),
    ]

    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='admin_notes')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='issue_admin_notes')
    note_type = models.CharField(max_length=20, choices=NOTE_TYPE_CHOICES, default='internal')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Admin note on {self.issue.title} by {self.author.username}"


# Workflow stage constants (ordered)
WORKFLOW_STAGES = [
    ('pending', 'Pending'),
    ('acknowledged', 'Acknowledged'),
    ('assigned_to_team', 'Assigned to Team'),
    ('resolution_done', 'Resolution Done'),
    ('validated', 'Validated'),
    ('remarks', 'Remarks (Closed)'),
]


class WorkflowTransition(models.Model):
    """Log each workflow step - who performed it, who it's assigned to, notes"""
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='workflow_transitions')
    from_stage = models.CharField(max_length=30, blank=True)  # empty for initial
    to_stage = models.CharField(max_length=30)
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflow_assignments'
    )
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workflow_actions')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.issue.title}: {self.from_stage} -> {self.to_stage}"


class Vote(models.Model):
    """Votes (upvotes/downvotes) on issues and comments"""
    VOTE_TYPE_CHOICES = [
        ('upvote', 'Upvote'),
        ('downvote', 'Downvote'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='votes')
    vote_type = models.CharField(max_length=10, choices=VOTE_TYPE_CHOICES)
    
    # Generic foreign key approach - vote can be on issue or comment
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, null=True, blank=True, related_name='votes')
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='votes')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [
            ['user', 'issue'],
            ['user', 'comment'],
        ]
        indexes = [
            models.Index(fields=['issue', 'vote_type']),
            models.Index(fields=['comment', 'vote_type']),
        ]

    def __str__(self):
        target = self.issue or self.comment
        return f"{self.vote_type} by {self.user.username} on {target}"


class IssueView(models.Model):
    """Track issue views for analytics"""
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name='views')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['issue', 'user', 'ip_address']
        indexes = [
            models.Index(fields=['issue', '-viewed_at']),
        ]

    def __str__(self):
        return f"View of {self.issue.title} at {self.viewed_at}"
