import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = { title: 'Foundations/Tailwind tokens' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ThemeUtilities: Story = {
  render: (_, context) => (
    <div className="bg-gt-card text-gt-ink font-gt-body p-4" data-testid="token-utility">
      {context.globals.locale === 'pt-BR' ? 'Uma superfície de cartão.' : 'A card surface.'}
    </div>
  ),
};
