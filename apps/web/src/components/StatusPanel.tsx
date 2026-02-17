type StatusPanelProps = {
  error: string;
  loading: boolean;
};

export function StatusPanel({ error, loading }: StatusPanelProps) {
  return (
    <>
      {error && <div className="response error">{error}</div>}
      {loading && !error && <div className="response loading">Загрузка...</div>}
    </>
  );
}
