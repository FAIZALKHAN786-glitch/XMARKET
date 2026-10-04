import { PostWizard } from "@/components/post-wizard";

export const metadata = {
  title: "Post a requirement",
  description:
    "Describe the job once — category, specs, must-haves, budget ceiling and deadline — and let matched providers come to you.",
};

export default function PostPage() {
  return <PostWizard />;
}
