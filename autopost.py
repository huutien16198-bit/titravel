import requests
import json
import csv
import time
import base64
from datetime import datetime

# --- CONFIGURATION ---
# You can also load this from a config.json file
CONFIG = [
    {
        "site": "https://your-wordpress-site.com",
        "username": "admin",
        "application_password": "xxxx xxxx xxxx xxxx xxxx xxxx"
    }
]

# AI API Configuration (Example for Gemini)
GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"

class WordPressAutoPoster:
    def __init__(self, site_url, username, app_password):
        self.site_url = site_url
        self.username = username
        self.app_password = app_password
        self.auth = base64.b64encode(f"{username}:{app_password}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {self.auth}"
        }

    def publish_post(self, title, content, status="publish", categories=None, tags=None, featured_media=None, slug=None, meta=None):
        endpoint = f"{self.site_url}/wp-json/wp/v2/posts"
        data = {
            "title": title,
            "content": content,
            "status": status,
            "categories": categories or [],
            "tags": tags or [],
        }
        if featured_media:
            data["featured_media"] = featured_media
        if slug:
            data["slug"] = slug
        if meta:
            data["meta"] = meta

        response = requests.post(endpoint, json=data, headers=self.headers)
        if response.status_code == 201:
            print(f"[OK] Post published: {title}")
            return response.json()
        else:
            print(f"[ERROR] Failed to publish post: {response.text}")
            return None

    def upload_image(self, image_url, filename="featured-image.jpg"):
        endpoint = f"{self.site_url}/wp-json/wp/v2/media"
        try:
            img_data = requests.get(image_url).content
            headers = self.headers.copy()
            headers.update({
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "image/jpeg"
            })
            response = requests.post(endpoint, data=img_data, headers=headers)
            if response.status_code == 201:
                return response.json()["id"]
            else:
                print(f"[ERROR] Failed upload image: {response.text}")
                return None
        except Exception as e:
            print(f"[ERROR] Image upload exception: {str(e)}")
            return None

def generate_content_ai(keyword):
    # This is a placeholder for AI generation logic
    # In a real scenario, you would call Gemini or OpenAI API here
    print(f"Generating content for: {keyword}...")
    title = f"Kinh nghiệm {keyword} mới nhất 2024"
    content = f"<!-- AI Generated Content for {keyword} -->\n<p>Chào mừng bạn đến với bài viết về {keyword}...</p>"
    return title, content

def bulk_post_from_csv(file_path, poster):
    with open(file_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            keyword = row.get('keyword')
            category = row.get('category')
            tags = row.get('tags', '').split(';')
            num_posts = int(row.get('number_of_posts', 1))

            for i in range(num_posts):
                title, content = generate_content_ai(keyword)
                poster.publish_post(title, content, categories=[category], tags=tags)
                time.sleep(2) # Avoid hitting rate limits

if __name__ == "__main__":
    # Example Usage
    site_config = CONFIG[0]
    poster = WordPressAutoPoster(site_config["site"], site_config["username"], site_config["application_password"])
    
    print("--- WordPress Auto Poster CLI ---")
    print("1. Post single article")
    print("2. Bulk post from CSV")
    choice = input("Select option: ")

    if choice == "1":
        keyword = input("Enter keyword: ")
        title, content = generate_content_ai(keyword)
        poster.publish_post(title, content)
    elif choice == "2":
        csv_file = input("Enter CSV file path (e.g., posts.csv): ")
        bulk_post_from_csv(csv_file, poster)
