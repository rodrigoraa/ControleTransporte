type ToastProps = {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
};

export function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div className={`toast ${type}`} onAnimationEnd={onClose}>
      {message}
    </div>
  );
}
