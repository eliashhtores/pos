from django.core.management.base import BaseCommand
from api.models import Category, Product


SEED_DATA = [
    {
        "category": "Beverages",
        "products": [
            {"name": "Coffee", "price": "2.50", "stock": 100},
            {"name": "Tea", "price": "1.75", "stock": 100},
            {"name": "Orange Juice", "price": "3.00", "stock": 80},
            {"name": "Water (500ml)", "price": "1.00", "stock": 200},
            {"name": "Lemonade", "price": "2.25", "stock": 60},
        ],
    },
    {
        "category": "Snacks",
        "products": [
            {"name": "Chips (Regular)", "price": "1.50", "stock": 150},
            {"name": "Chocolate Bar", "price": "1.25", "stock": 120},
            {"name": "Granola Bar", "price": "2.00", "stock": 90},
            {"name": "Pretzel Pack", "price": "1.75", "stock": 100},
            {"name": "Cookies (Pack)", "price": "3.00", "stock": 70},
        ],
    },
    {
        "category": "Food",
        "products": [
            {"name": "Sandwich", "price": "5.50", "stock": 40},
            {"name": "Salad Bowl", "price": "7.00", "stock": 30},
            {"name": "Burger", "price": "8.50", "stock": 50},
            {"name": "Hot Dog", "price": "4.00", "stock": 60},
            {"name": "Pizza Slice", "price": "3.50", "stock": 45},
        ],
    },
    {
        "category": "Dairy",
        "products": [
            {"name": "Milk (1L)", "price": "1.80", "stock": 80},
            {"name": "Yogurt", "price": "2.20", "stock": 70},
            {"name": "Cheese Slice", "price": "0.75", "stock": 100},
        ],
    },
]


class Command(BaseCommand):
    help = "Seed the database with sample products and categories"

    def handle(self, *args, **options):
        created_categories = 0
        created_products = 0

        for entry in SEED_DATA:
            category, cat_created = Category.objects.get_or_create(name=entry["category"])
            if cat_created:
                created_categories += 1

            for p in entry["products"]:
                _, prod_created = Product.objects.get_or_create(
                    name=p["name"],
                    defaults={
                        "price": p["price"],
                        "stock": p["stock"],
                        "category": category,
                    },
                )
                if prod_created:
                    created_products += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_categories} categories and {created_products} products."
            )
        )
