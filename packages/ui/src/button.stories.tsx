import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Create trip' },
  render: (args, context) => (
    <Button {...args}>{context.globals.locale === 'pt-BR' ? 'Criar viagem' : 'Create trip'}</Button>
  ),
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Disabled: Story = { args: { isDisabled: true } };
export const Loading: Story = { args: { isPending: true } };
export const Thread: Story = { args: { variant: 'thread' } };
export const Quiet: Story = { args: { variant: 'quiet' } };
export const Danger: Story = { args: { variant: 'danger' } };
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
