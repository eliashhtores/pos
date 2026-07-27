from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from decouple import config


class Command(BaseCommand):
    help = "Create a default admin user if no users exist (for first-run setup)"

    def handle(self, *args, **options):
        username = config("DJANGO_ADMIN_USER", default="admin")
        pwd = config("DJANGO_ADMIN_PASSWORD", default="admin")
        email = config("DJANGO_ADMIN_EMAIL", default="admin@example.com")

        if User.objects.filter(username=username).exists():
            self.stdout.write(f"User '{username}' already exists, skipping.")
            return

        User.objects.create_superuser(username=username, email=email, **{'password': pwd})
        self.stdout.write(
            self.style.SUCCESS(f"Created superuser '{username}'.")
        )
