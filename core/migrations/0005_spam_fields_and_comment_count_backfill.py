from django.db import migrations, models


def backfill_comments_count(apps, schema_editor):
    """Recompute Issue.comments_count from existing visible (non-deleted) comments.

    Some old rows were left at 0 because the counter was never incremented at
    create time. This brings them into sync.
    """
    Issue = apps.get_model('core', 'Issue')
    Comment = apps.get_model('core', 'Comment')

    # Group counts per issue once instead of n+1
    from django.db.models import Count
    counts = (
        Comment.objects
        .filter(is_deleted=False)
        .values('issue_id')
        .annotate(n=Count('id'))
    )
    by_issue = {row['issue_id']: row['n'] for row in counts}

    # Update any issue whose stored count differs from actual count
    for issue in Issue.objects.all().only('id', 'comments_count'):
        actual = by_issue.get(issue.id, 0)
        if issue.comments_count != actual:
            Issue.objects.filter(pk=issue.id).update(comments_count=actual)


def noop_reverse(apps, schema_editor):
    # Reverse direction does nothing - counts are derived data, not destructive.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_issue_submission_token_alter_tag_name_alter_tag_slug_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="spam_status",
            field=models.CharField(
                choices=[
                    ("clean", "Clean"),
                    ("flagged", "Flagged as spam"),
                    ("skipped", "Skipped (no filter)"),
                ],
                db_index=True,
                default="clean",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="issue",
            name="spam_reason",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="issue",
            name="spam_score",
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name="issue",
            name="spam_checked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_comments_count, noop_reverse),
    ]
