import { Button } from "@k22i/ui/components/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
} from "@k22i/ui/components/menu";

export interface WidgetTypeOption {
  label: string;
  type: string;
}

const DEFAULT_TYPE = "text";

export const AddWidgetButton = ({
  onAdd,
  types,
}: {
  onAdd: (type: string) => void;
  types?: WidgetTypeOption[];
}) => {
  if (!types || types.length === 0) {
    return (
      <Button onClick={() => onAdd(DEFAULT_TYPE)} variant="outline">
        Add text widget
      </Button>
    );
  }

  return (
    <Menu>
      <MenuTrigger render={<Button variant="outline" />}>
        Add widget
      </MenuTrigger>
      <MenuPopup align="start">
        {types.map(({ label, type }) => (
          <MenuItem key={type} onClick={() => onAdd(type)}>
            {label}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
};
