
from playwright.sync_api import sync_playwright

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the dashboard
        page.goto("http://localhost:8080/index.html")

        # Wait for dashboard to load (check for header)
        page.wait_for_selector("header")

        # Wait a bit for charts to render (they might be empty but canvas should be there)
        page.wait_for_timeout(2000)

        # Take a screenshot
        page.screenshot(path="/home/jules/verification/dashboard.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
