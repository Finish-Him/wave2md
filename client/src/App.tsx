import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import NewProject from "./pages/NewProject";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Settings from "./pages/Settings";
import QuickTranscribe from "./pages/QuickTranscribe";
import Templates from "./pages/Templates";
import SharedProject from "./pages/SharedProject";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import ChatBot from "./components/ChatBot";

function Router() {
  return (
    <Switch>
        <Route path={"/"} component={Home} />
      <Route path="/share/:token" component={SharedProject} />
      <Route path={"/404"} component={NotFound} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/transcribe" component={QuickTranscribe} />
      <Route path="/settings" component={Settings} />
      <Route path="/templates" component={Templates} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          <PWAInstallPrompt />
          <ChatBot />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
