using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using SilverShark;

namespace SilverShark.Services;

public class FileDialogService
{
    public Task<string> ShowOpenFileDialogAsync()
    {
        var tcs = new TaskCompletionSource<string>();
        Thread staThread = new Thread(() =>
        {
            try
            {
                using (var ownerForm = new Form())
                {
                    ownerForm.Text = "Select Excel File";
                    ownerForm.WindowState = FormWindowState.Minimized;
                    ownerForm.ShowInTaskbar = true;
                    ownerForm.TopMost = true;
                    ownerForm.Show();

                    using (OpenFileDialog openFileDialog = new OpenFileDialog())
                    {
                        openFileDialog.InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                        openFileDialog.Filter = "Excel Files (*.xlsx)|*.xlsx";
                        openFileDialog.FilterIndex = 1;
                        openFileDialog.RestoreDirectory = true;

                        if (openFileDialog.ShowDialog(ownerForm) == DialogResult.OK)
                        {
                            tcs.SetResult(openFileDialog.FileName);
                        }
                        else
                        {
                            tcs.SetResult(null);
                        }
                    }
                    ownerForm.Close();
                }
            }
            catch (Exception ex)
            {
                // It's crucial to log this exception or handle it appropriately.
                // For now, we'll propagate it to the TaskCompletionSource.
                // Consider using the Logger class here if it's accessible or passed in.
                Logger.Log($"Exception in ShowOpenFileDialogAsync (STA thread): {ex.Message}");
                tcs.SetException(ex);
            }
        });
        staThread.SetApartmentState(ApartmentState.STA);
        staThread.Start();
        return tcs.Task;
    }
} 