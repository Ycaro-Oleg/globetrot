import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusMark, type StatusMarkKind } from './status-mark';

const labels: Record<'en' | 'pt-BR', Record<StatusMarkKind, string>> = {
  en: { estimate: 'Estimate', confirmed: 'Confirmed', paid: 'Paid', unknown: 'Unknown' },
  'pt-BR': {
    estimate: 'Estimativa',
    confirmed: 'Confirmado',
    paid: 'Pago',
    unknown: 'Desconhecido',
  },
};
const meta = {
  title: 'Primitives/StatusMark',
  component: StatusMark,
  args: { status: 'estimate', children: 'Estimate' },
  render: (args, context) => (
    <StatusMark {...args}>
      {labels[context.globals.locale === 'pt-BR' ? 'pt-BR' : 'en'][args.status]}
    </StatusMark>
  ),
} satisfies Meta<typeof StatusMark>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Estimate: Story = {};
export const Confirmed: Story = { args: { status: 'confirmed' } };
export const Paid: Story = { args: { status: 'paid' } };
export const Unknown: Story = { args: { status: 'unknown' } };
