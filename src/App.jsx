import HomePage from "@/pages/HomePage";
import PosterPage from "@/pages/PosterPage";
import { getRoute } from "@/utils/route";

// Routing is read once at module-eval time. The poster is a static, shareable
// snapshot — no in-app navigation between routes — so there's no need for a
// reactive router or history listener.
const route = getRoute();

export default function App() {
  if (route === "poster") {
    return <PosterPage />;
  }
  return <HomePage />;
}
