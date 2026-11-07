import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Modal } from './modal';

function Example({ isPt, initiallyOpen }: { isPt: boolean; initiallyOpen: boolean }) {
  const [isOpen, setOpen] = useState(initiallyOpen);
  return (
    <div>
      <Button onPress={() => setOpen(true)}>{isPt ? 'Abrir detalhes' : 'Open details'}</Button>
      <Modal
        isOpen={isOpen}
        onOpenChange={setOpen}
        title={isPt ? 'Detalhes da viagem' : 'Trip details'}
        closeLabel={isPt ? 'Fechar' : 'Close'}
      >
        <p>
          {isPt
            ? 'Suas alterações ainda não foram aplicadas.'
            : 'Your changes have not been applied yet.'}
        </p>
      </Modal>
    </div>
  );
}
const meta = {
  title: 'Primitives/Modal',
  component: Modal,
  args: {
    isOpen: false,
    onOpenChange: () => {},
    title: 'Trip details',
    closeLabel: 'Close',
    children: 'Content',
  },
  render: (_, context) => (
    <Example isPt={context.globals.locale === 'pt-BR'} initiallyOpen={false} />
  ),
} satisfies Meta<typeof Modal>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Closed: Story = {};
export const Open: Story = {
  render: (_, context) => <Example isPt={context.globals.locale === 'pt-BR'} initiallyOpen />,
};
