import type { Meta, StoryObj } from '@storybook/react-vite';
import { SegmentedControl } from './segmented-control';

const meta = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControl,
  args: {
    label: 'Appearance',
    options: [
      { id: 'day', label: 'Day' },
      { id: 'night', label: 'Night' },
      { id: 'system', label: 'System' },
    ],
    defaultValue: 'day',
  },
  render: (args, context) => {
    const isPt = context.globals.locale === 'pt-BR';
    return (
      <SegmentedControl
        {...args}
        label={isPt ? 'Aparência' : 'Appearance'}
        options={
          isPt
            ? [
                { id: 'day', label: 'Dia' },
                { id: 'night', label: 'Noturno' },
                { id: 'system', label: 'Sistema' },
              ]
            : args.options
        }
      />
    );
  },
} satisfies Meta<typeof SegmentedControl>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { isDisabled: true } };
