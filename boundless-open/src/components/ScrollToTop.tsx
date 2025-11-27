import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      if (window && window.location && window.location.hash) {
        const u = new URL(window.location.href);
        if (u.hash) {
          u.hash = "";
          window.history.replaceState(window.history.state, document.title, u.toString());
        }
      }
    } catch (e) {
      // ignore
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
