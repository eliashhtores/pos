from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_product_name_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="barcode",
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
        migrations.CreateModel(
            name="AccountPayable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("due_date", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["due_date"],
            },
        ),
    ]
