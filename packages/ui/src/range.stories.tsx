import type { Meta, StoryObj } from '@storybook/react-vite';
import { Range } from './range';

const meta = {
  title: 'Primitives/Range',
  component: Range,
  args: { label: 'Monthly savings', minValue: 0, maxValue: 100, defaultValue: 40 },
  render: (args, context) => (
    <Range
      {...args}
      label={context.globals.locale === 'pt-BR' ? 'Economia mensal' : 'Monthly savings'}
    />
  ),
} satisfies Meta<typeof Range>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { isDisabled: true } };
