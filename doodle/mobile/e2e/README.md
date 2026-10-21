# Detail picker native layout checks

These checks require the explicitly enabled `nl.samistudio.doodle.fixture` build. They never call the production image provider.

On iOS, generate a standalone XCTest runner with `ruby mobile/scripts/create-layout-test-project.rb /tmp/doodle-detail-tests`, using the `xcodeproj` gem from the installed CocoaPods environment. Install the fixture on the target simulator, then run `xcodebuild -project /tmp/doodle-detail-tests/DetailHarness.xcodeproj -scheme DetailUITests -destination 'platform=iOS Simulator,id=<device-id>' CODE_SIGNING_ALLOWED=NO test`. The test checks all detail options, selection, saved preference and unchanged input dimensions. It supports scrolling at large accessibility sizes.

On Android, supply the QA SDK executable and emulator serial explicitly: `QA_ADB=/path/to/adb QA_SERIAL=emulator-5554 python3 mobile/e2e/verify-detail-android.py /path/to/qa-output`. It captures regular, 360x640 and 150% text layouts, checks the selected input dimensions and relaunch persistence, then restores the original display and font settings. `QA_CASE=large-text` selects just that case. Use a dedicated QA emulator with no generation or purchase in progress.
