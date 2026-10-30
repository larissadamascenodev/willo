import { Easing, LinearTransition } from "react-native-reanimated";

/**
 * How things below move when something opens above them.
 *
 * A spring here overshoots: the rows underneath drop past where they belong, come
 * back up, and settle, which reads as a wobble rather than as room being made. Time
 * and an ease-out make them travel once, straight to their place.
 */
export const EXPAND = LinearTransition.duration(420).easing(Easing.bezier(0.22, 1, 0.36, 1));
