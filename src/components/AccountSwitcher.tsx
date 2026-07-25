import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useApp } from '@/context/AppContext';
import { useFeedback } from '@/components/feedback';
import { Button, ModalCloseButton } from '@/components/ui';

/**
 * Small always-visible button (shown above the Dashboard) that opens a sheet for switching
 * between, creating, renaming, and deleting local trading accounts. Language/theme/display
 * mode stay global across all accounts - only trading data (balance, trades, images, ...)
 * changes when the active account changes.
 */
export default function AccountSwitcher() {
  const { theme, isRTL, accounts, activeAccountId, switchAccount, createAccount, renameAccount, deleteAccount } = useApp();
  const { showToast, confirm } = useFeedback();
  const [visible, setVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? accounts[0];
  const row = isRTL ? ('row-reverse' as const) : ('row' as const);

  const close = () => {
    if (busy) return;
    setVisible(false);
    setEditingId(null);
    setNewName('');
  };

  const handleSwitch = async (id: string) => {
    if (id === activeAccountId || busy) return;
    setBusy(true);
    try {
      await switchAccount(id);
      setVisible(false);
    } catch {
      showToast({ title: isRTL ? 'تغییر حساب ناموفق بود' : 'Could not switch account', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim() || busy) return;
    setBusy(true);
    try {
      await renameAccount(editingId, editingName.trim());
      setEditingId(null);
    } catch {
      showToast({ title: isRTL ? 'تغییر نام ناموفق بود' : 'Could not rename account', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      await createAccount(newName.trim());
      setNewName('');
      setVisible(false);
      showToast({ title: isRTL ? 'حساب جدید ساخته شد' : 'New account created', tone: 'success' });
    } catch {
      showToast({ title: isRTL ? 'ساخت حساب ناموفق بود' : 'Could not create account', tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (accounts.length <= 1) {
      showToast({
        title: isRTL ? 'حذف امکان‌پذیر نیست' : 'Cannot delete',
        message: isRTL ? 'حداقل یک حساب باید باقی بماند.' : 'At least one account must remain.',
        tone: 'warning',
      });
      return;
    }
    confirm({
      title: isRTL ? 'حذف حساب' : 'Delete account',
      message: isRTL
        ? `همه معاملات، تصاویر و یادداشت‌های «${name}» برای همیشه حذف می‌شود. این کار قابل بازگشت نیست.`
        : `All trades, images, and notes in "${name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: isRTL ? 'حذف شود' : 'Delete',
      cancelLabel: isRTL ? 'انصراف' : 'Cancel',
      destructive: true,
      onConfirm: async () => {
        await deleteAccount(id);
        showToast({ title: isRTL ? 'حساب حذف شد' : 'Account deleted', tone: 'success' });
      },
    });
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            flexDirection: row,
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={[styles.triggerIcon, { backgroundColor: theme.colors.primarySoft, borderColor: `${theme.colors.primary}44` }]}>
          <Feather name="users" size={14} color={theme.colors.primaryGlow} />
        </View>
        <Text numberOfLines={1} style={[styles.triggerText, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>
          {activeAccount?.name ?? (isRTL ? 'حساب من' : 'My account')}
        </Text>
        <Feather name="chevron-down" size={16} color={theme.colors.textSubtle} />
      </Pressable>

      <Modal transparent visible={visible} animationType="slide" onRequestClose={close}>
        <Pressable style={[styles.overlay, { backgroundColor: theme.colors.overlay }]} onPress={close}>
          <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.sheetHead, { flexDirection: row }]}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL ? 'حساب‌های معاملاتی' : 'Trading accounts'}
              </Text>
              <ModalCloseButton onPress={close} disabled={busy} />
            </View>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {accounts.map((account) => {
                const active = account.id === activeAccountId;
                const editing = editingId === account.id;
                return (
                  <View
                    key={account.id}
                    style={[
                      styles.accountRow,
                      {
                        flexDirection: row,
                        backgroundColor: active ? theme.colors.primarySoft : theme.colors.backgroundElevated,
                        borderColor: active ? theme.colors.primaryGlow : theme.colors.border,
                      },
                    ]}
                  >
                    {editing ? (
                      <>
                        <TextInput
                          value={editingName}
                          onChangeText={setEditingName}
                          autoFocus
                          style={[styles.editInput, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left', borderColor: theme.colors.borderFocus }]}
                        />
                        <Pressable onPress={saveEdit} disabled={busy} style={styles.iconButton}>
                          <Feather name="check" size={17} color={theme.colors.success} />
                        </Pressable>
                        <Pressable onPress={() => setEditingId(null)} disabled={busy} style={styles.iconButton}>
                          <Feather name="x" size={17} color={theme.colors.textSubtle} />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <Pressable onPress={() => handleSwitch(account.id)} style={{ flex: 1, flexDirection: row, alignItems: 'center', gap: 10 }}>
                          <Feather name={active ? 'check-circle' : 'circle'} size={17} color={active ? theme.colors.primaryGlow : theme.colors.textSubtle} />
                          <Text numberOfLines={1} style={[styles.accountName, { color: theme.colors.text, textAlign: isRTL ? 'right' : 'left', flex: 1 }]}>
                            {account.name}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => startEdit(account.id, account.name)} disabled={busy} style={styles.iconButton}>
                          <Feather name="edit-2" size={15} color={theme.colors.textSubtle} />
                        </Pressable>
                        <Pressable onPress={() => handleDelete(account.id, account.name)} disabled={busy} style={styles.iconButton}>
                          <Feather name="trash-2" size={15} color={theme.colors.danger} />
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={[styles.newRow, { flexDirection: row }]}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder={isRTL ? 'نام حساب جدید' : 'New account name'}
                placeholderTextColor={theme.colors.textSubtle}
                style={[styles.newInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.backgroundElevated, textAlign: isRTL ? 'right' : 'left' }]}
              />
              <View style={{ minWidth: 96 }}>
                <Button title={isRTL ? 'افزودن' : 'Add'} onPress={handleCreate} icon="plus" disabled={busy || !newName.trim()} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    maxWidth: '100%',
  },
  triggerIcon: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  triggerText: { fontSize: 12, fontWeight: '900', flexShrink: 1, maxWidth: 160 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, padding: 18, maxHeight: '80%', gap: 14 },
  sheetHead: { alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '900', flex: 1 },
  accountRow: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 12 },
  accountName: { fontSize: 14, fontWeight: '800' },
  iconButton: { padding: 6 },
  editInput: { flex: 1, fontSize: 14, fontWeight: '800', borderBottomWidth: 1, paddingVertical: 4 },
  newRow: { alignItems: 'center', gap: 8, marginTop: 4 },
  newInput: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 14, fontWeight: '700' },
});
