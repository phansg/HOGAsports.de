<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
$file = __DIR__ . '/data/visits.txt';
$dir = dirname($file);
if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
if (!file_exists($file)) { @file_put_contents($file, "0"); }
$fp = @fopen($file, 'c+');
if (!$fp) { http_response_code(500); echo json_encode(['error'=>'counter unavailable']); exit; }
flock($fp, LOCK_EX);
rewind($fp);
$count = (int)trim(stream_get_contents($fp));
if (isset($_GET['hit']) && $_GET['hit'] === '1') {
  $count++;
  rewind($fp); ftruncate($fp, 0); fwrite($fp, (string)$count); fflush($fp);
}
flock($fp, LOCK_UN); fclose($fp);
echo json_encode(['count'=>$count]);
