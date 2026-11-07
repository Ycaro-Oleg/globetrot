import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from './select-field';

const meta = {
  title: 'Primitives/SelectField',
  component: SelectField,
  args: {
    label: 'Currency',
    placeholder: 'Choose a currency',
    options: [
      { id: 'USD', label: 'US dollar' },
      { id: 'BRL', label: 'Brazilian real' },
    ],
  },
  render: (args, context) => {
    const isPt = context.globals.locale === 'pt-BR';
    return (
      <SelectField
        {...args}
        label={isPt ? 'Moeda' : 'Currency'}
        placeholder={isPt ? 'Escolha uma moeda' : 'Choose a currency'}
        errorMessage={isPt ? 'Escolha uma moeda.' : 'Choose a currency.'}
        options={
          isPt
            ? [
                { id: 'USD', label: 'Dólar americano' },
                { id: 'BRL', label: 'Real brasileiro' },
              ]
            : args.options
        }
      />
    );
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Disabled: Story = { args: { isDisabled: true } };
export const Invalid: Story = { args: { isInvalid: true, errorMessage: 'Choose a currency' } };
