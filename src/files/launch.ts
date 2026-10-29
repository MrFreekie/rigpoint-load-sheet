// Double-click to open (manifest file_handlers). When the installed app is
// launched with a show file, Chrome and Edge desktop pass its handle through launchQueue.
// Elsewhere launchQueue does not exist and this does nothing.

export function firstLaunchedFile(params: LaunchParams): FileSystemFileHandle | null {
  const handle = params.files[0];
  return handle && handle.kind === 'file' ? (handle as FileSystemFileHandle) : null;
}

export function onLaunchFile(open: (handle: FileSystemFileHandle) => void): void {
  window.launchQueue?.setConsumer((params) => {
    const handle = firstLaunchedFile(params);
    if (handle) open(handle);
  });
}
