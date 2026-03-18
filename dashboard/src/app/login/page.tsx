import { signIn } from "@/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-500 tracking-tight">ZUID</h1>
          <p className="text-gray-400 mt-2 text-sm">ClickUp Dashboards</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 shadow-xl border border-white/5">
          <h2 className="text-white text-xl font-semibold mb-2">Inloggen</h2>
          <p className="text-gray-400 text-sm mb-6">
            Log in met je ZUID Google-account om toegang te krijgen.
          </p>

          <ErrorMessage searchParams={searchParams} />

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/financial" });
            }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <GoogleIcon />
              Inloggen met Google
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            Alleen @zuid.com adressen hebben toegang.
          </p>
        </div>
      </div>
    </div>
  );
}

async function ErrorMessage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  if (!params.error) return null;

  const messages: Record<string, string> = {
    AccessDenied: "Je hebt geen toegang. Neem contact op met Ruben.",
    Default: "Er is iets misgegaan. Probeer het opnieuw.",
  };

  const message = messages[params.error] ?? messages.Default;

  return (
    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      {message}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
