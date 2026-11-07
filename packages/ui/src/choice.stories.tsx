import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, Switch } from './choice';

const meta = {
  title: 'Primitives/Choices',
  component: Checkbox,
  args: { children: 'Send reminders' },
  render: (args, context) => (
    <Checkbox {...args}>
      {context.globals.locale === 'pt-BR' ? 'Enviar lembretes' : 'Send reminders'}
    </Checkbox>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultSelected: true } };
export const Indeterminate: Story = { args: { isIndeterminate: true } };
export const Disabled: Story = { args: { isDisabled: true } };
export const Toggle: Story = {
  render: (_, context) => (
    <Switch>
      {context.globals.locale === 'pt-BR' ? 'Lembretes de economia' : 'Savings reminders'}
    </Switch>
  ),
};
