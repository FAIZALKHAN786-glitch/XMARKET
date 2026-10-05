import Link from "next/link";
import { Briefcase, Store } from "lucide-react";
import { Card } from "@/components/ui/primitives";

export const metadata = {
  title: "Sign in",
  description: "Choose whether you are buying or selling to continue.",
};

const CHOICES = [
  {
    href: "/signin/buyer",
    icon: Briefcase,
    title: "I am a buyer",
    body: "Post what you need and let providers come to you.",
  },
  {
    href: "/signin/seller",
    icon: Store,
    title: "I am a seller",
    body: "Receive a merchant ID and bid on requirements in your domain.",
  },
];

export default function SignInPage() {
  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Are you a buyer or a seller?
        </h1>
        <p className="mt-3 text-sm leading-relaxed muted">
          You can change from buyer to seller or vice versa.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <Link key={choice.href} href={choice.href} className="block">
              <Card hover className="h-full">
                <span className="grid size-10 place-items-center rounded-lg border border-white/12 bg-white/5 text-white/80">
                  <choice.icon className="size-5" />
                </span>
                <p className="mt-4 text-[0.9375rem] font-semibold text-white">
                  {choice.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed muted">
                  {choice.body}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
