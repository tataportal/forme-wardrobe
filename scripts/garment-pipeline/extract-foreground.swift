import Foundation
import CoreGraphics
import CoreImage
import CoreML
import Vision

@available(macOS 15.0, *)
func preferNonANE<Request: VisionRequest>(_ request: inout Request) {
    for stage in [Vision.ComputeStage.main, .postProcessing] {
        guard let devices = request.supportedComputeStageDevices[stage],
              !devices.isEmpty else {
            continue
        }
        let preferred = devices.first(where: {
            if case .cpu = $0 { return true }
            return false
        }) ?? devices.first(where: {
            if case .gpu = $0 { return true }
            return false
        }) ?? devices[0]
        request.setComputeDevice(preferred, for: stage)
    }
}

enum ForegroundError: Error, CustomStringConvertible {
    case usage
    case noObservation
    case noInstances
    case noColorSpace

    var description: String {
        switch self {
        case .usage:
            return "usage: extract-foreground <input-image> <output-png>"
        case .noObservation:
            return "Vision returned no foreground observation"
        case .noInstances:
            return "Vision found no foreground instances"
        case .noColorSpace:
            return "Could not create the sRGB color space"
        }
    }
}

@main
struct ForegroundExtractor {
    static func main() async {
        do {
            guard CommandLine.arguments.count == 3 else {
                throw ForegroundError.usage
            }

            let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
            let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
            let handler = ImageRequestHandler(inputURL)
            var request = GenerateForegroundInstanceMaskRequest()
            preferNonANE(&request)
            let observation = try await handler.perform(request)

            guard let observation else {
                throw ForegroundError.noObservation
            }
            guard !observation.allInstances.isEmpty else {
                throw ForegroundError.noInstances
            }

            let maskedBuffer = try observation.generateMaskedImage(
                for: observation.allInstances,
                imageFrom: handler,
                croppedToInstancesExtent: false
            )

            let image = CIImage(cvPixelBuffer: maskedBuffer)
            let context = CIContext(options: [
                .cacheIntermediates: false,
                .workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB) as Any
            ])
            guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
                throw ForegroundError.noColorSpace
            }

            try context.writePNGRepresentation(
                of: image,
                to: outputURL,
                format: .RGBA8,
                colorSpace: colorSpace,
                options: [:]
            )

            let payload: [String: Any] = [
                "instances": observation.allInstances.map { $0 },
                "confidence": observation.confidence,
                "method": "Vision.GenerateForegroundInstanceMaskRequest.revision1"
            ]
            let data = try JSONSerialization.data(
                withJSONObject: payload,
                options: [.sortedKeys]
            )
            FileHandle.standardOutput.write(data)
            FileHandle.standardOutput.write(Data([0x0A]))
        } catch {
            FileHandle.standardError.write(
                Data("extract-foreground: \(error)\n".utf8)
            )
            exit(1)
        }
    }
}
