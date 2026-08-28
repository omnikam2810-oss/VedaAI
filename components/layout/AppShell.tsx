"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ClipboardList,
  FolderOpen,
  HelpCircle,
  Home,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { SCHOOL_NAME, TEACHER_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { SparkleIcon, VedaLogo } from "@/components/ui/Brand";
import { useAssessment } from "@/components/AssessmentProvider";

export type ShellVariant = "upload" | "processing" | "assessment";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/", label: "My Classroom", icon: Users },
  { href: "/assessment", label: "Assignments", icon: FolderOpen },
  { href: "/", label: "Exams", icon: ClipboardList, active: true },
  { href: "/?demo=1", label: "My Library", icon: BookOpen },
];

export function AppShell({
  variant,
  children,
}: {
  variant: ShellVariant;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const collapsed = variant !== "upload";
  const darkRail = variant === "assessment";

  return (
    <div className="flex min-h-screen bg-[#ececec] p-2 md:p-3 md:gap-3">
      <Sidebar
        variant={variant}
        collapsed={collapsed}
        darkRail={darkRail}
        className="hidden md:flex"
        onHelp={() => setHelpOpen(true)}
        onNotice={setNotice}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenu={() => setMobileOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onNotes={() => {
            setProfileOpen(false);
            setNotesOpen((value) => !value);
          }}
          notesOpen={notesOpen}
          profileOpen={profileOpen}
          onProfile={() => {
            setNotesOpen(false);
            setProfileOpen((value) => !value);
          }}
        />
        <main className="mt-2 min-h-0 flex-1 overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          {children}
        </main>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/30" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] p-2">
            <Sidebar
              variant="upload"
              collapsed={false}
              darkRail={false}
              onNavigate={() => setMobileOpen(false)}
              onHelp={() => {
                setMobileOpen(false);
                setHelpOpen(true);
              }}
              onNotice={(message) => {
                setMobileOpen(false);
                setNotice(message);
              }}
            />
          </div>
        </div>
      ) : null}
      {helpOpen ? <HelpModal onClose={() => setHelpOpen(false)} /> : null}
      {notice ? <NoticeModal message={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  );
}

function Sidebar({
  variant,
  collapsed,
  darkRail,
  className,
  onNavigate,
  onHelp,
  onNotice,
}: {
  variant: ShellVariant;
  collapsed: boolean;
  darkRail: boolean;
  className?: string;
  onNavigate?: () => void;
  onHelp?: () => void;
  onNotice?: (message: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { startProcessing } = useAssessment();

  return (
    <aside
      className={cn(
        "flex h-[calc(100vh-1.5rem)] flex-col rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.05)]",
        darkRail ? "bg-[#1c1c1c] text-white" : "bg-white text-[#1a1a1a]",
        collapsed ? "w-[76px] items-center px-2" : "w-[250px]",
        className,
      )}
    >
      <VedaLogo compact={collapsed} inverted={darkRail} className={cn(collapsed && "justify-center")} />

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          router.push("/");
        }}
        className={cn(
          "mt-5 flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium text-white toolkit-border",
          collapsed && "h-11 w-11 justify-center px-0",
        )}
        aria-label="AI Teacher's Toolkit"
      >
        <SparkleIcon className="h-4 w-4 text-[#ff8a65]" />
        {!collapsed ? <span>AI Teacher&apos;s Toolkit</span> : <span className="text-lg leading-none">+</span>}
      </button>

      <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.label === "Exams" && (pathname === "/" || pathname === "/assessment");
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onNavigate?.();
                if (item.label === "My Library") {
                  void startProcessing(true).then((ok) => {
                    if (ok) router.push("/assessment");
                  });
                  return;
                }
                if (item.label === "My Classroom") {
                  onNotice?.(
                    "My Classroom is part of the full VedaAI product. This assignment uses Exams to upload a question paper and map answers.",
                  );
                  return;
                }
                if (item.label === "Assignments") {
                  router.push("/assessment");
                  return;
                }
                router.push("/");
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] transition",
                collapsed && "justify-center px-0",
                active
                  ? darkRail
                    ? "bg-white/10 text-white"
                    : "bg-[#f3f3f3] font-medium text-black"
                  : darkRail
                    ? "text-white/70 hover:bg-white/10"
                    : "text-[#4b4b4b] hover:bg-[#f7f7f7]",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {!collapsed ? item.label : <span className="sr-only">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onHelp?.();
        }}
        className={cn(
          "mb-3 flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
          collapsed && "justify-center px-0",
          darkRail ? "text-white/70" : "text-[#4b4b4b]",
        )}
      >
        <Settings className="h-[18px] w-[18px]" />
        {!collapsed ? "Settings" : <span className="sr-only">Settings</span>}
      </button>

      {!collapsed ? (
        <div className="rounded-2xl bg-[#f6f6f6] p-3">
          <div className="flex items-center gap-2">
            <SchoolCrest />
            <p className="text-[11px] font-medium leading-4 text-[#333]">{SCHOOL_NAME}</p>
          </div>
        </div>
      ) : (
        <SchoolCrest className={darkRail ? "border-white/20" : ""} />
      )}

      {variant === "upload" && !collapsed ? (
        <button
          type="button"
          className="mt-3 text-left text-[11px] text-[#8b8b8b] underline-offset-2 hover:underline"
          onClick={() => {
            onNavigate?.();
            void startProcessing(true).then((ok) => {
              if (ok) router.push("/assessment");
            });
          }}
        >
          Load demo dataset
        </button>
      ) : null}
    </aside>
  );
}

function Header({
  onMenu,
  onHelp,
  onNotes,
  notesOpen,
  profileOpen,
  onProfile,
}: {
  onMenu: () => void;
  onHelp: () => void;
  onNotes: () => void;
  notesOpen: boolean;
  profileOpen: boolean;
  onProfile: () => void;
}) {
  const router = useRouter();
  const { result, processing } = useAssessment();

  return (
    <header className="relative flex h-14 items-center justify-between rounded-[20px] bg-white px-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)] md:px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full p-1.5 text-[#333] hover:bg-[#f4f4f4]"
          aria-label="Back to exams"
          onClick={() => router.push("/")}
        >
          <span className="text-lg leading-none">←</span>
        </button>
        <div className="hidden items-center gap-2 md:flex">
          <ClipboardList className="h-4 w-4 text-[#555]" />
          <span className="text-sm font-medium">Exams</span>
        </div>
        <div className="md:hidden">
          <VedaLogo />
        </div>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <button type="button" className="hidden rounded-full p-2 text-[#444] hover:bg-[#f4f4f4] md:inline-flex" aria-label="Help" onClick={onHelp}>
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>
        <button type="button" className="relative rounded-full p-2 text-[#444] hover:bg-[#f4f4f4]" aria-label="Notifications" onClick={onNotes}>
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff6b4a]" />
        </button>
        <span className="hidden rounded-full p-2 text-[#444] md:inline-flex" aria-hidden>
          <SparkleIcon className="h-4 w-4 text-[#ff6b4a]" />
        </span>
        <button type="button" className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[#f7f7f7] md:flex" onClick={onProfile} aria-label="Teacher profile">
          <Avatar />
          <span className="text-sm font-medium">{TEACHER_NAME}</span>
          <ChevronDown className="h-4 w-4 text-[#777]" />
        </button>
        <Avatar className="md:hidden" />
        <button type="button" className="rounded-full p-2 md:hidden" aria-label="Open menu" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {profileOpen ? (
        <div className="absolute right-4 top-14 z-20 w-72 rounded-2xl border border-[#eee] bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold">{TEACHER_NAME}</p>
          <p className="mt-1 text-sm text-[#666]">{SCHOOL_NAME}</p>
          <p className="mt-2 text-xs text-[#888]">Signed in for this local session. There is no separate account page in this assignment.</p>
        </div>
      ) : null}
      {notesOpen ? (
        <div className="absolute right-4 top-14 z-20 w-72 rounded-2xl border border-[#eee] bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="mt-2 text-sm text-[#666]">
            {processing
              ? "Extraction is in progress."
              : result
                ? `Assessment ready · ${result.summary.totalQuestions} questions extracted.`
                : "No new notifications. Upload a question paper and answer sheet to begin."}
          </p>
        </div>
      ) : null}
    </header>
  );
}

function Avatar({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#c9b8a6] text-[11px] font-semibold text-white", className)}>
      MR
    </span>
  );
}

function SchoolCrest({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ddd] bg-white text-[10px] font-bold text-[#1c4c8c]", className)}>
      DPS
    </span>
  );
}

function NoticeModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Not in this assignment</h2>
        <p className="mt-3 text-sm leading-6 text-[#444]">{message}</p>
        <button type="button" className="mt-5 rounded-full bg-[#1c1c1c] px-4 py-2 text-sm font-semibold text-white" onClick={onClose}>
          Back to Exams
        </button>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/30" aria-label="Close help" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <button type="button" className="absolute right-4 top-4 rounded-full p-1 hover:bg-[#f4f4f4]" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">How mapping works</h2>
        <ol className="mt-4 space-y-2 text-sm text-[#444]">
          <li>1. Upload the printed question paper and the student answer sheet.</li>
          <li>2. VedaAI extracts questions, including labelled sub-parts.</li>
          <li>3. Handwritten answers are segmented with page and region data.</li>
          <li>4. Explicit numbers are mapped first; remaining answers are mapped semantically.</li>
          <li>5. Uncertain results are marked for review. Coordinates are never invented.</li>
        </ol>
      </div>
    </div>
  );
}
