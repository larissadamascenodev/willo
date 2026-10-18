/**
 * The icons, one file at a time.
 *
 * Same family as the web app, so a glyph is the same glyph on both. They are pulled
 * in one by one rather than from the package's barrel: the barrel is a single file
 * holding every icon lucide ships, which Metro refuses to resolve here and which
 * would weigh down the bundle even if it did.
 *
 * Add to this list as screens need them, and keep it alphabetical.
 */
export { default as ArrowLeftRight } from "lucide-react-native/icons/arrow-left-right";
export { default as ChevronRight } from "lucide-react-native/icons/chevron-right";
export { default as House } from "lucide-react-native/icons/house";
export { default as Plus } from "lucide-react-native/icons/plus";
export { default as Sparkles } from "lucide-react-native/icons/sparkles";
export { default as CreditCard } from "lucide-react-native/icons/credit-card";
export { default as Pencil } from "lucide-react-native/icons/pencil";
export { default as RefreshCw } from "lucide-react-native/icons/refresh-cw";
export { default as Search } from "lucide-react-native/icons/search";
/* lucide 1.x renamed trash-2 to trash; the name here stays Trash2 so the
   screens read like the web ones. */
export { default as Trash2 } from "lucide-react-native/icons/trash";
export { default as Wallet } from "lucide-react-native/icons/wallet";
