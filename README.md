# Thí nghiệm ảo KHTN 7 - Bài 9: Đo tốc độ bằng Cổng quang điện & Đồng hồ hiện số

Mô phỏng thí nghiệm ảo tương tác 2D và 3D sinh động phục vụ công tác giảng dạy và học tập bài 9 môn Khoa học tự nhiên 7 (các bộ sách Cánh diều, Kết nối tri thức, Chân trời sáng tạo).

---

## 🌟 Tính năng nổi bật

1. **Sơ đồ 2D SGK phóng to rõ nét**: 
   - Thiết kế theo chuẩn sơ đồ Hình 9.3 SGK.
   - Vạch chia thước đo tương phản cao (màu đen đậm, cỡ chữ lớn), dễ dàng quan sát trên máy chiếu/bảng tương tác.
   - Trục máng trượt xoay quanh tâm vật lý chuẩn xác, chân đỡ trái luôn khớp nối với thước ở mọi góc nghiêng.
2. **Mô hình 3D sinh động**:
   - Trực quan hóa 3D không gian phòng thí nghiệm.
   - Viên bi thép vàng ánh kim kích thước lớn, hiệu ứng ánh sáng chất lượng cao.
   - Điều khiển góc nhìn camera xoay, thu phóng tự do.
3. **Bảng ghi số liệu thực hành & Tính trung bình**:
   - Ghi nhận số liệu đo thời gian thực của các lượt chạy (Lần 1, Lần 2, Lần 3...).
   - Tự động tính toán giá trị trung bình của quãng đường ($\bar{s}$), thời gian ($\bar{t}$) và tốc độ ($\bar{v}$) tức thì, hỗ trợ học sinh lập báo cáo thực hành chuẩn xác.
4. **So sánh sai số với bấm tay thủ công**:
   - Tích hợp tính năng bấm giờ thủ công bằng phím `SPACE` để so sánh với cổng quang điện tự động.
   - Tính toán sai số tuyệt đối và phần trăm sai số, giúp học sinh nhận thức rõ sự vượt trội về độ chính xác của cổng quang điện.

---

## 🚀 Hướng dẫn khởi chạy ứng dụng

### Trên hệ điều hành Windows:
1. Bạn chỉ cần kích đúp (nhấp đúp chuột) vào tệp **`Khởi động ứng dụng.bat`** trong thư mục này.
2. Cửa sổ dòng lệnh sẽ tự động khởi động máy chủ cục bộ và mở ứng dụng trên trình duyệt web mặc định của bạn tại địa chỉ: `http://127.0.0.1:8080`.

### Trên hệ điều hành khác (macOS / Linux):
1. Mở Terminal tại thư mục dự án này.
2. Chạy lệnh:
   ```bash
   npx http-server . -p 8080 -c-1
   ```
3. Truy cập địa chỉ `http://127.0.0.1:8080` trên trình duyệt web của bạn.

---

## 🛠️ Công nghệ sử dụng
- **HTML5 & SVG**: Cho sơ đồ vector 2D sắc nét, co giãn không vỡ hình.
- **Vanilla CSS**: Giao diện tối hiện đại, hiệu ứng kính mờ (Glassmorphism), hiển thị tối ưu trên nhiều kích cỡ màn hình.
- **Three.js**: Thư viện đồ họa 3D WebGL hiệu năng cao giúp hiển thị mô hình 3D mượt mà.
- **Web Audio API**: Tạo âm thanh va chạm, tiếng lăn và tiếng bíp còi chân thực bằng code (không cần tệp âm thanh rời).

---

*Phát triển bởi đội ngũ hỗ trợ dạy học trực quan môn Khoa học tự nhiên.*
