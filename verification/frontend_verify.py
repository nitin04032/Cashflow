
from playwright.sync_api import sync_playwright

def verify_add_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the add page
        page.goto("http://localhost:8080/add.html")

        # Wait for form
        page.wait_for_selector("#entryForm")

        # Wait a bit
        page.wait_for_timeout(1000)

        # Take a screenshot
        page.screenshot(path="/home/jules/verification/add_page.png")

        # Also try changing flow to OUT and take another screenshot
        page.select_option("#flow", "OUT")
        page.wait_for_timeout(500)
        page.screenshot(path="/home/jules/verification/add_page_out.png")

        browser.close()

if __name__ == "__main__":
    verify_add_page()
