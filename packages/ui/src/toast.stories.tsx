import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Toast } from './toast';

function Example({ isPt }: { isPt: boolean }) {
  const [visible, setVisible] = useState(true);
  return (
    <div>
      {!visible && (
        <Button onPress={() => setVisible(true)}>{isPt ? 'Mostrar aviso' : 'Show notice'}</Button>
      )}
      {visible && (
        <Toast
          message={isPt ? 'Parada removida.' : 'Stop removed.'}
          undoLabel={isPt ? 'Desfazer' : 'Undo'}
          dismissLabel={isPt ? 'Dispensar' : 'Dismiss'}
          onUndo={() => setVisible(false)}
          onDismiss={() => setVisible(false)}
        />
      )}
    </div>
  );
}
const meta = {
  title: 'Primitives/Toast',
  component: Toast,
  args: { message: 'Stop removed.', dismissLabel: 'Dismiss', onDismiss: () => {} },
  render: (_, context) => <Example isPt={context.globals.locale === 'pt-BR'} />,
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WithUndo: Story = {};
