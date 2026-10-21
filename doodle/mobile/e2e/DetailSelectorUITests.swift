import XCTest

final class DetailSelectorUITests: XCTestCase {
    func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
    func testCompactDetailPicker() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "nl.samistudio.doodle.fixture")
        app.launch()
        let trigger = app.buttons["detail-trigger"]
        XCTAssertTrue(trigger.waitForExistence(timeout: 15))
        XCTAssertGreaterThanOrEqual(trigger.frame.height, 44)
        let input = app.textViews.firstMatch
        let before = input.frame
        capture("ios-detail-closed")
        trigger.tap()
        let medium = app.descendants(matching: .any)["detail-choice-medium"]
        XCTAssertTrue(medium.waitForExistence(timeout: 8))
        XCTAssertTrue(app.descendants(matching: .any)["detail-choice-simple"].isHittable)
        print(app.debugDescription)
        let detailed = app.descendants(matching: .any)["detail-choice-detailed"]
        for _ in 0..<4 {
            if detailed.isHittable { break }
            app.scrollViews.containing(.any, identifier: "detail-choice-medium").firstMatch.swipeUp()
        }
        XCTAssertTrue(detailed.isHittable)
        for _ in 0..<4 {
            if medium.isHittable { break }
            app.scrollViews.containing(.any, identifier: "detail-choice-medium").firstMatch.swipeDown()
        }
        capture("ios-detail-open")
        medium.tap()
        XCTAssertTrue(trigger.waitForExistence(timeout: 8))
        XCTAssertTrue(trigger.label.contains("Medium") || trigger.label.contains("متوسط"))
        XCTAssertEqual(input.frame, before)
        app.terminate()
        app.launch()
        XCTAssertTrue(trigger.waitForExistence(timeout: 10))
        XCTAssertTrue(trigger.label.contains("Medium") || trigger.label.contains("متوسط"))
        trigger.tap()
        XCTAssertTrue(medium.waitForExistence(timeout: 8))
        capture("ios-detail-persisted-open")
    }
}
