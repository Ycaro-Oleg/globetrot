import type { Meta, StoryObj } from '@storybook/react-vite';
import { Banner } from './banner';

const labels = {
  en: {
    info: 'Changes are saved.',
    success: 'Your trip is ready.',
    error: 'The changes could not be saved.',
  },
  'pt-BR': {
    info: 'As alterações foram salvas.',
    success: 'Sua viagem está pronta.',
    error: 'Não foi possível salvar as alterações.',
  },
};
const meta = {
  title: 'Primitives/Banner',
  component: Banner,
  args: { children: 'Changes are saved.' },
  render: (args, context) => (
    <Banner {...args}>
      {labels[context.globals.locale === 'pt-BR' ? 'pt-BR' : 'en'][args.tone || 'info']}
    </Banner>
  ),
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Info: Story = {};
export const Success: Story = { args: { tone: 'success' } };
export const Error: Story = { args: { tone: 'error' } };
