<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Allow all origins for local testing
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Database Credentials - CHANGE THESE
$host = "localhost"; 
$db = "cashflow_db"; // Your database name
$user = "root";      // Your database user
$pass = "";          // Your database password (empty for default XAMPP root)

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // Ensure table exists
    $pdo->exec("CREATE TABLE IF NOT EXISTS entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        flow VARCHAR(3) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        person VARCHAR(255),
        party VARCHAR(255),
        mode VARCHAR(50),
        category VARCHAR(50),
        remarks TEXT
    )");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error: " . $e->getMessage()]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // FETCH ALL ENTRIES
        $stmt = $pdo->query("SELECT * FROM entries ORDER BY date, id ASC");
        $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($entries);
        break;

    case 'POST':
        // ADD NEW ENTRY
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) {
            echo json_encode(["success" => false, "message" => "Invalid input data."]);
            break;
        }

        $sql = "INSERT INTO entries (date, flow, amount, person, party, mode, category, remarks) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        
        try {
            $stmt->execute([
                $data['date'],
                $data['flow'],
                $data['amount'],
                $data['person'],
                $data['party'],
                $data['mode'],
                $data['category'],
                $data['remarks']
            ]);
            echo json_encode(["success" => true, "message" => "Entry added successfully.", "id" => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Failed to save entry: " . $e->getMessage()]);
        }
        break;

    case 'DELETE':
        // DELETE ENTRY
        $data = json_decode(file_get_contents("php://input"), true);
        $id = $data['id'] ?? 0;
        
        $sql = "DELETE FROM entries WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        
        try {
            $stmt->execute([$id]);
            if ($stmt->rowCount() > 0) {
                echo json_encode(["success" => true, "message" => "Entry deleted successfully."]);
            } else {
                echo json_encode(["success" => false, "message" => "Entry not found."]);
            }
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["success" => false, "message" => "Failed to delete entry: " . $e->getMessage()]);
        }
        break;
}
?>