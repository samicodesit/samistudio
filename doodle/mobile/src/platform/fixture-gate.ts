const FIXTURE_APPLICATION_ID = "nl.samistudio.doodle.fixture";

export function isNativeFixtureMode(applicationId: string | null, explicitFlag: unknown): boolean {
  return applicationId === FIXTURE_APPLICATION_ID && explicitFlag === true;
}
