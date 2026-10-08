import { forwardRef } from "react";
import { Icon, LucideProps } from "lucide-react-native";

const Blank = forwardRef<SVGElement, LucideProps>((props, ref) => (
  <Icon ref={ref} {...props} iconNode={[]} />
));

export default Blank
