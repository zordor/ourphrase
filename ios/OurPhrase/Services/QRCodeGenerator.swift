import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

enum QRCodeGenerator {
    static func image(for value: String) -> Image? {
        let filter = CIFilter.qrCodeGenerator()
        let context = CIContext()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: .init(scaleX: 12, y: 12)),
              let cgImage = context.createCGImage(output, from: output.extent)
        else { return nil }
        return Image(decorative: cgImage, scale: 1)
    }
}
