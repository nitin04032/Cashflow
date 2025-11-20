
from playwright.sync_api import sync_playwright
import os

def verify_features():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        # Get absolute path to index.html
        cwd = os.getcwd()
        index_path = f"file://{cwd}/index.html"

        print(f"Navigating to {index_path}")
        page.goto(index_path)

        # Wait for dashboard to load (and fetch mock data if any)
        # Since fetchEntries is an API call, it might fail if backend isn't there.
        # But the HTML structure should be there.

        # 1. Verify Theme Toggle exists
        # It is injected by theme.js asynchronously.
        # Wait for it to appear using a generous timeout
        try:
            toggle_btn = page.locator("#themeToggle")
            toggle_btn.wait_for(state="attached", timeout=10000)
            print("Theme toggle found.")
        except Exception as e:
            print(f"Theme toggle NOT found: {e}")

        # 2. Screenshot Light Mode
        page.screenshot(path="verification/dashboard_light.png")
        print("Screenshot Light Mode saved.")

        # 3. Toggle Dark Mode
        if toggle_btn.count() > 0:
            try:
                toggle_btn.click()
                page.wait_for_timeout(1000) # wait for transition
                # 4. Screenshot Dark Mode
                page.screenshot(path="verification/dashboard_dark.png")
                print("Screenshot Dark Mode saved.")
            except Exception as e:
                 print(f"Could not click toggle: {e}")

        # 5. Verify Mobile Layout (Responsive)
        page.set_viewport_size({'width': 375, 'height': 812}) # iPhone X size
        page.wait_for_timeout(500)
        page.screenshot(path="verification/dashboard_mobile.png")
        print("Screenshot Mobile Mode saved.")

        browser.close()

if __name__ == "__main__":
    verify_features()
