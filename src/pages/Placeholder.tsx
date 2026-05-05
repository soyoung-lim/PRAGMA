import { Link } from "react-router-dom";
import { WorkflowHeader } from "@/components/WorkflowHeader";

interface PlaceholderProps {
  step: number;
  title: string;
}

const Placeholder = ({ step, title }: PlaceholderProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkflowHeader currentStep={step} />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold sm:text-3xl">{step}. {title}</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          이 단계는 다음 작업에서 구현될 예정입니다.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-block rounded-lg border border-foreground bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            ← 시나리오 선택으로 돌아가기
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Placeholder;
