import { cookies } from "next/headers";
import Link from "next/link";
import { DoodleClient } from "@/components/doodle-client";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { pickSuggestions } from "@/lib/scenes/suggestions";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const secret = process.env.SESSION_SECRET;
  const initialAuthenticated = Boolean(token && secret && verifySessionToken(token, secret));

  return (
    <>
      <header className="doodle-header">
        <Link className="doodle-wordmark" href="/" aria-label="Doodle home">
          Doodle<span aria-hidden="true">.</span>
        </Link>
      </header>
      <main className="doodle-main">
        <DoodleClient initialAuthenticated={initialAuthenticated} suggestions={pickSuggestions()} />
      </main>
    </>
  );
}
