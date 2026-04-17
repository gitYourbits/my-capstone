from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Only allow staff/superuser access."""
    message = "Admin access required."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class IsAuthorOrReadOnly(permissions.BasePermission):
    """Allow edits/deletes only to content author."""

    message = "You can only modify your own content."

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and getattr(obj, "author_id", None) == request.user.id
