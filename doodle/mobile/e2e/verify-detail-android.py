"""Exercise the bundled fixture on an explicitly supplied QA emulator."""
import json, os, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path

adb = os.environ["QA_ADB"]
serial = os.environ["QA_SERIAL"]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
package = "nl.samistudio.doodle.fixture"

def command(*args):
    return subprocess.check_output([adb, "-s", serial, *args], text=True).strip()

def tree():
    command("shell", "rm", "-f", "/data/local/tmp/doodle-detail.xml")
    result=command("shell", "uiautomator", "dump", "/data/local/tmp/doodle-detail.xml")
    if "dumped to" not in result: raise RuntimeError("Accessibility snapshot not ready")
    return ET.fromstring(command("shell", "cat", "/data/local/tmp/doodle-detail.xml"))

def find(root, key, value):
    return next((e for e in root.iter("node") if e.get(key) == value), None)

def bounds(node):
    return list(map(int, re.findall(r"\d+", node.get("bounds"))))

def wait_node(key, value):
    end = time.monotonic() + 45
    while time.monotonic() < end:
        try: root = tree()
        except (RuntimeError, subprocess.CalledProcessError, ET.ParseError):
            time.sleep(.25)
            continue
        node = find(root, key, value)
        if node is not None: return root, node
        time.sleep(.25)
    raise AssertionError(f"Missing {key}={value}")

def tap(node):
    x1,y1,x2,y2 = bounds(node)
    command("shell", "input", "tap", str((x1+x2)//2), str((y1+y2)//2))

def screenshot(name):
    command("shell", "screencap", "-p", "/data/local/tmp/doodle-detail.png")
    command("pull", "/data/local/tmp/doodle-detail.png", str(out / f"{name}.png"))

def launch():
    command("shell", "am", "force-stop", package)
    command("shell", "am", "start", "-n", f"{package}/nl.samistudio.doodle.MainActivity")

checks=[]
original_size=command("shell","wm","size")
original_override=re.search(r"Override size: (\d+x\d+)",original_size)
original_font=command("shell","settings","get","system","font_scale")
try:
    for name, small, font in [("regular", False, "1.0"), ("small", True, "1.0"), ("large-text", True, "1.5")]:
        if os.environ.get("QA_CASE") and name != os.environ["QA_CASE"]: continue
        command("shell","wm","size", "945x1680" if small else "1080x2400")
        command("shell","settings","put","system","font_scale",font)
        launch()
        root, trigger=wait_node("resource-id","detail-trigger")
        before=bounds(find(root,"content-desc","Describe a scene"))
        screenshot(f"android-{name}-closed")
        tap(trigger)
        root, medium=wait_node("resource-id","detail-choice-medium")
        assert all(find(root,"resource-id",f"detail-choice-{level}") is not None for level in ["simple","medium","detailed"])
        screenshot(f"android-{name}-open")
        tap(medium)
        root, trigger=wait_node("resource-id","detail-trigger")
        assert trigger.get("content-desc")=="Detail: Medium"
        assert bounds(find(root,"content-desc","Describe a scene"))==before
        checks.append({"case":name,"fontScale":font,"composerInputBounds":before,"triggerBounds":bounds(trigger),"allLevelsPresent":True})
    command("shell","settings","put","system","font_scale","1.0")
    command("shell","wm","size","1080x2400")
    launch()
    _, trigger=wait_node("resource-id","detail-trigger"); tap(trigger)
    _, simple=wait_node("resource-id","detail-choice-simple"); tap(simple)
    wait_node("content-desc","Detail: Simple")
    launch()
    _, trigger=wait_node("content-desc","Detail: Simple"); tap(trigger)
    _, medium=wait_node("resource-id","detail-choice-medium"); tap(medium)
    wait_node("content-desc","Detail: Medium")
    checks.append({"savedSimpleSurvivesRelaunch":True,"returnedToMedium":True})
finally:
    command("shell","wm","size",original_override.group(1) if original_override else "reset")
    command("shell","settings","put","system","font_scale",original_font)
(out / "android-layout-checks.json").write_text(json.dumps(checks,indent=2)+"\n")
print(json.dumps(checks))
