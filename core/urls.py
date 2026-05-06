from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView, CurrentUserView,
    UserViewSet, StateViewSet, DistrictViewSet, CityViewSet,
    CategoryViewSet, TagViewSet, IssueViewSet,
    MediaViewSet, CommentViewSet, SearchView,
    AdminDashboardStatsView, AdminGrievanceViewSet,
    AdminStaffListView, AssignmentCategoryViewSet,
    AdminSpamReportsView, AdminSpamUnflagView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'states', StateViewSet, basename='state')
router.register(r'districts', DistrictViewSet, basename='district')
router.register(r'cities', CityViewSet, basename='city')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'issues', IssueViewSet, basename='issue')
router.register(r'media', MediaViewSet, basename='media')
router.register(r'comments', CommentViewSet, basename='comment')

admin_router = DefaultRouter()
admin_router.register(r'grievances', AdminGrievanceViewSet, basename='admin-grievance')
admin_router.register(r'assignment-categories', AssignmentCategoryViewSet, basename='admin-assignment-category')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', CurrentUserView.as_view(), name='current_user'),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/staff/', AdminStaffListView.as_view(), name='admin_staff'),
    path('admin/spam/', AdminSpamReportsView.as_view(), name='admin_spam_reports'),
    path('admin/spam/<int:pk>/unflag/', AdminSpamUnflagView.as_view(), name='admin_spam_unflag'),
    path('admin/', include(admin_router.urls)),
    path('search/', SearchView.as_view(), name='search'),
    path('', include(router.urls)),
]

