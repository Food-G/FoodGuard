// 이미지 파일을 압축/리사이즈 없이 원본 그대로 base64 data URL로 변환한다.
// DB(image_url, LONGTEXT)에 그대로 저장된다.
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
