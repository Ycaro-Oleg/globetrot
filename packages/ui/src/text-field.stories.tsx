import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './text-field';

const meta = {
  title: 'Primitives/TextField',
  component: TextField,
  args: { label: 'Trip name' },
  render: (args, context) => (
    <TextField
      {...args}
      label={context.globals.locale === 'pt-BR' ? 'Nome da viagem' : 'Trip name'}
      description={
        context.globals.locale === 'pt-BR'
          ? 'Escolha um nome para seu roteiro.'
          : 'Choose a name for your itinerary.'
      }
      errorMessage={
        context.globals.locale === 'pt-BR' ? 'Informe o nome da viagem.' : 'Enter a trip name.'
      }
    />
  ),
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Multiline: Story = { args: { multiline: true } };
export const Invalid: Story = { args: { isInvalid: true } };
export const Disabled: Story = { args: { isDisabled: true } };
