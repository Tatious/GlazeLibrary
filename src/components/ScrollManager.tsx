import {
  ScrollRestoration,
  type ScrollRestorationProps,
} from "@tatious/ui";
import { useLocation, useNavigationType } from "react-router-dom";

const getBehavior: NonNullable<ScrollRestorationProps["getBehavior"]> = ({
  location,
  navigationType,
  previousLocation,
}) => {
  const isQueryOnlyNavigation =
    navigationType !== "POP" &&
    previousLocation?.pathname === location.pathname &&
    previousLocation.search !== location.search &&
    !location.hash;

  return isQueryOnlyNavigation ? "preserve" : undefined;
};

export function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <ScrollRestoration
      location={location}
      navigationType={navigationType}
      storageKey="glaze-library"
      getBehavior={getBehavior}
    />
  );
}
